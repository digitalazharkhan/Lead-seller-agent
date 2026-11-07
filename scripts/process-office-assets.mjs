#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFFICE_DIR = path.join(REPO_ROOT, "public", "office");
const OUTPUT_DIR = path.join(OFFICE_DIR, "processed");
const PIXEL_OUTPUT_DIR = path.join(OFFICE_DIR, "processed-pixel");
const PIXEL_ONLY = process.argv.includes("--pixel-only");
const REPLACE_PIXEL_OUTPUTS = process.argv.includes("--replace-pixel");
const CHARACTER_SOURCES = [
  { name: "azhar", file: "characters/azhar.png", background: "dark" },
  { name: "khan", file: "characters/khan.jpg", background: "white" },
  { name: "ali", file: "characters/ali.jpg", background: "checker", grid: { columns: 8, rows: 3, rowColumns: [8, 8, 6], inset: 5 } },
  { name: "ayesha", file: "characters/Ayesha.png", background: "alpha" },
  { name: "hassan", file: "characters/hassan.jpg", background: "checker", grid: { columns: 8, rows: 3, rowColumns: [8, 8, 6], inset: 5 } },
  { name: "sara", file: "characters/Sara.png", background: "alpha" },
  { name: "usman", file: "characters/usman.png", background: "alpha" },
  { name: "zainab", file: "characters/Zainab.png", background: "alpha" },
];

const DARK_THRESHOLD = 76;
const REPLACE_GENERATED_OUTPUTS = process.argv.includes("--replace-processed");
const COMPONENT_ALPHA_THRESHOLD = 24;
const MIN_COMPONENT_AREA = 1_200;
const MIN_COMPONENT_WIDTH = 38;
const MIN_COMPONENT_HEIGHT = 64;

function assertSafeOutputPath(destination) {
  const resolved = path.resolve(destination);
  if (!resolved.startsWith(`${OUTPUT_DIR}${path.sep}`) && resolved !== OUTPUT_DIR) {
    throw new Error(`Refusing to write outside ${OUTPUT_DIR}: ${destination}`);
  }
}

async function writeProcessedFile(destination, contents) {
  assertSafeOutputPath(destination);
  await fs.writeFile(destination, contents, {
    flag: REPLACE_GENERATED_OUTPUTS ? "w" : "wx",
  });
}

function borderIndexes(width, height, callback) {
  for (let x = 0; x < width; x += 1) {
    callback(x);
    if (height > 1) callback((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    callback(y * width);
    if (width > 1) callback(y * width + width - 1);
  }
}

function floodMaskFromBorder(width, height, isBackgroundPixel) {
  const size = width * height;
  const marked = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  const enqueue = (index, parentIndex = null) => {
    if (marked[index] || !isBackgroundPixel(index, parentIndex)) return;
    marked[index] = 1;
    queue[tail++] = index;
  };
  borderIndexes(width, height, enqueue);

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) enqueue(index - 1, index);
    if (x + 1 < width) enqueue(index + 1, index);
    if (index >= width) enqueue(index - width, index);
    if (index + width < size) enqueue(index + width, index);
  }
  return marked;
}

function estimateCheckerColors(data, width, height, channels) {
  const histogram = new Uint32Array(256);
  borderIndexes(width, height, (index) => {
    const offset = index * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 24) return;
    const luminance = Math.round((r + g + b) / 3);
    if (luminance >= 65 && luminance <= 238) histogram[luminance] += 1;
  });

  const peaks = [];
  for (let value = 66; value <= 237; value += 1) {
    let score = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      score += histogram[value + offset] ?? 0;
    }
    peaks.push({ value, score });
  }
  peaks.sort((left, right) => right.score - left.score);

  const centers = [];
  for (const peak of peaks) {
    if (centers.every((center) => Math.abs(center - peak.value) >= 28)) {
      centers.push(peak.value);
      if (centers.length === 2) break;
    }
  }
  if (centers.length !== 2) {
    throw new Error(`Could not identify two checkerboard colors on image border (found ${centers.join(", ")}).`);
  }

  return { centers: centers.sort((left, right) => left - right) };
}

function removeBackground(data, width, height, channels, method, grid = null) {
  if (method === "alpha") {
    return { details: "Retained source alpha channel." };
  }

  let backgroundPixel;
  let details;
  if (method === "white") {
    backgroundPixel = (index) => {
      const offset = index * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      return Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 28;
    };
    details = "Removed border-connected neutral white/light-gray background and sheet grid pixels (RGB >= 200, chroma <= 28).";
  } else if (method === "dark") {
    backgroundPixel = (index, parentIndex) => {
      const offset = index * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha <= 12) return false;
      if (parentIndex === null) {
        return Math.max(r, g, b) <= DARK_THRESHOLD &&
          Math.max(r, g, b) - Math.min(r, g, b) <= 48;
      }
      const parentOffset = parentIndex * channels;
      const dr = r - data[parentOffset];
      const dg = g - data[parentOffset + 1];
      const db = b - data[parentOffset + 2];
      const localDistance = Math.sqrt(dr * dr + dg * dg + db * db);
      return Math.max(r, g, b) <= 180 && localDistance <= 22;
    };
    details = "Removed border-connected dark backdrop using local RGB tolerance (seed max <= 76; neighboring pixel distance <= 22, max channel <= 180).";
  } else if (method === "checker") {
    const checker = estimateCheckerColors(data, width, height, channels);
    backgroundPixel = (index) => {
      const offset = index * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const alpha = data[offset + 3];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const luminance = (r + g + b) / 3;
      return alpha > 12 && chroma <= 28 &&
        checker.centers.some((center) => Math.abs(luminance - center) <= 24);
    };
    details = `Removed border-connected neutral checker pixels near RGB ${checker.centers.map((v) => `${v},${v},${v}`).join(" and ")} (tolerance 24).`;
  } else {
    throw new Error(`Unknown background removal method: ${method}`);
  }

  let mask;
  if (method === "checker" && grid) {
    mask = new Uint8Array(width * height);
    const cellHeight = Math.floor(height / grid.rows);
    for (let row = 0; row < grid.rows; row += 1) {
      const columns = grid.rowColumns?.[row] ?? grid.columns;
      for (let column = 0; column < columns; column += 1) {
        const cellLeft = Math.floor((column * width) / columns);
        const cellRight = Math.floor(((column + 1) * width) / columns);
        const left = cellLeft + grid.inset;
        const top = row * cellHeight + grid.inset;
        const innerWidth = cellRight - cellLeft - 2 * grid.inset;
        const innerHeight = cellHeight - 2 * grid.inset;
        const cellMask = floodMaskFromBorder(
          innerWidth,
          innerHeight,
          (index) => backgroundPixel(
            (top + Math.floor(index / innerWidth)) * width + left + (index % innerWidth),
          ),
        );
        for (let index = 0; index < cellMask.length; index += 1) {
          if (!cellMask[index]) continue;
          const x = index % innerWidth;
          const y = Math.floor(index / innerWidth);
          mask[(top + y) * width + left + x] = 1;
        }
      }
    }
  } else {
    mask = floodMaskFromBorder(width, height, backgroundPixel);
  }
  let removed = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) continue;
    data[index * channels + 3] = 0;
    removed += 1;
  }
  return { details, removedPixels: removed };
}

function findComponents(data, width, height, channels) {
  const size = width * height;
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  const components = [];

  for (let start = 0; start < size; start += 1) {
    if (visited[start] || data[start * channels + 3] < COMPONENT_ALPHA_THRESHOLD) continue;

    let head = 0;
    let tail = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    visited[start] = 1;
    queue[tail++] = start;

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (let dy = -1; dy <= 1; dy += 1) {
        const nextY = y + dy;
        if (nextY < 0 || nextY >= height) continue;
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          if (nextX < 0 || nextX >= width) continue;
          const nextIndex = nextY * width + nextX;
          if (visited[nextIndex] || data[nextIndex * channels + 3] < COMPONENT_ALPHA_THRESHOLD) continue;
          visited[nextIndex] = 1;
          queue[tail++] = nextIndex;
        }
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    if (tail < MIN_COMPONENT_AREA ||
        componentWidth < MIN_COMPONENT_WIDTH ||
        componentHeight < MIN_COMPONENT_HEIGHT) {
      continue;
    }
    const aspectRatio = componentWidth / componentHeight;
    if (aspectRatio < 0.16 || aspectRatio > 2.4) continue;

    components.push({
      left: minX,
      top: minY,
      width: componentWidth,
      height: componentHeight,
      pixelArea: tail,
    });
  }
  return components.sort((left, right) => left.top - right.top || left.left - right.left);
}

function findGridComponents(data, width, height, channels, grid) {
  const cellHeight = Math.floor(height / grid.rows);
  const components = [];
  for (let row = 0; row < grid.rows; row += 1) {
    const columns = grid.rowColumns?.[row] ?? grid.columns;
    for (let column = 0; column < columns; column += 1) {
      const cellLeft = Math.floor((column * width) / columns);
      const cellRight = Math.floor(((column + 1) * width) / columns);
      const left = cellLeft + grid.inset;
      const cellTop = row * cellHeight + grid.inset;
      const innerWidth = cellRight - cellLeft - 2 * grid.inset;
      const innerHeight = cellHeight - 2 * grid.inset;
      const cellData = Buffer.alloc(innerWidth * innerHeight * channels);
      for (let y = 0; y < innerHeight; y += 1) {
        const sourceOffset = ((cellTop + y) * width + left) * channels;
        const destinationOffset = y * innerWidth * channels;
        data.copy(cellData, destinationOffset, sourceOffset, sourceOffset + innerWidth * channels);
      }

      const cellComponents = findComponents(cellData, innerWidth, innerHeight, channels);
      const component = cellComponents.sort((left, right) => right.pixelArea - left.pixelArea)[0];
      if (!component) {
        throw new Error(`No pose found in source grid cell ${column + 1},${row + 1}.`);
      }
      components.push({
        ...component,
        left: component.left + left,
        top: component.top + cellTop,
        gridCell: { column: column + 1, row: row + 1 },
      });
    }
  }
  return components.sort((left, right) => left.top - right.top || left.left - right.left);
}

async function writeCharacterSheet(character) {
  const sourcePath = path.join(OFFICE_DIR, character.file);
  const decoded = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  if (channels !== 4) throw new Error(`Expected RGBA pixels for ${sourcePath}.`);
  const { data } = decoded;
  const background = removeBackground(data, width, height, channels, character.background, character.grid);
  const components = character.grid
    ? findGridComponents(data, width, height, channels, character.grid)
    : findComponents(data, width, height, channels);
  if (components.length === 0) throw new Error(`No character poses found in ${sourcePath}.`);

  const poseDirectory = path.join(OUTPUT_DIR, character.name);
  assertSafeOutputPath(poseDirectory);
  await fs.mkdir(poseDirectory, { recursive: true });
  const poses = [];
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const poseNumber = String(index + 1).padStart(2, "0");
    const filename = `${character.name}-${poseNumber}.png`;
    const destination = path.join(poseDirectory, filename);
    assertSafeOutputPath(destination);
    const trimmed = await sharp(data, { raw: { width, height, channels } })
      .extract({
        left: component.left,
        top: component.top,
        width: component.width,
        height: component.height,
      })
      .resize({ height: 96, fit: "inside", withoutEnlargement: false })
      .png()
      .toBuffer();
    const metadata = await sharp(trimmed).metadata();
    await writeProcessedFile(destination, trimmed);
    poses.push({
      index: index + 1,
      file: `${character.name}/${filename}`,
      width: metadata.width,
      height: metadata.height,
      sourceBounds: component,
    });
  }

  await writeContactSheet(character.name, poses);
  return {
    source: character.file,
    sourceSize: { width, height },
    backgroundRemoval: background,
    segmentation: {
      method: character.grid
        ? `8-connected alpha-component bounding boxes within ${character.grid.columns}x${character.grid.rows} source cells`
        : "8-connected alpha-component bounding boxes",
      alphaThreshold: COMPONENT_ALPHA_THRESHOLD,
      minimumComponentPixelArea: MIN_COMPONENT_AREA,
      filteredComponentCount: components.length,
      ...(character.grid ? { sourceGrid: character.grid } : {}),
    },
    poses,
  };
}

async function writeContactSheet(name, poses) {
  const columns = 5;
  const cellWidth = 140;
  const cellHeight = 126;
  const rows = Math.ceil(poses.length / columns);
  const width = columns * cellWidth;
  const height = rows * cellHeight;
  const composites = [];
  const labels = [];

  for (const pose of poses) {
    const image = await fs.readFile(path.join(OUTPUT_DIR, pose.file));
    const column = (pose.index - 1) % columns;
    const row = Math.floor((pose.index - 1) / columns);
    composites.push({
      input: image,
      left: column * cellWidth + Math.floor((cellWidth - pose.width) / 2),
      top: row * cellHeight + 20 + Math.floor((96 - pose.height) / 2),
    });
    labels.push(
      `<text x="${column * cellWidth + cellWidth / 2}" y="${row * cellHeight + 14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#171717">${String(pose.index).padStart(2, "0")}</text>`,
    );
  }

  const indexSvg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels.join("")}</svg>`,
  );
  const destination = path.join(OUTPUT_DIR, `contact-sheet-${name}.png`);
  assertSafeOutputPath(destination);
  const contactSheet = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 145, g: 145, b: 145, alpha: 1 },
    },
  })
    .composite([...composites, { input: indexSvg, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await writeProcessedFile(destination, contactSheet);
}

function addPixelOutline(data, width, height, channels) {
  const outlinedWidth = width + 2;
  const outlinedHeight = height + 2;
  const outlined = Buffer.alloc(outlinedWidth * outlinedHeight * channels);
  const outlineColor = [28, 27, 35, 255];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceOffset = (y * width + x) * channels;
      if (data[sourceOffset + 3] < 24) continue;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const targetOffset = ((y + 1 + dy) * outlinedWidth + x + 1 + dx) * channels;
          if (outlined[targetOffset + 3] === 0) {
            outlined.set(outlineColor, targetOffset);
          }
        }
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * width * channels;
    const targetOffset = ((y + 1) * outlinedWidth + 1) * channels;
    data.copy(outlined, targetOffset, sourceOffset, sourceOffset + width * channels);
  }
  return { data: outlined, width: outlinedWidth, height: outlinedHeight };
}

async function writePixelPose(sourcePath, relativeOutputPath) {
  const decoded = await sharp(sourcePath)
    .ensureAlpha()
    .resize({ height: 48, fit: "inside", withoutEnlargement: false, kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const outlined = addPixelOutline(
    decoded.data,
    decoded.info.width,
    decoded.info.height,
    decoded.info.channels,
  );
  const output = await sharp(outlined.data, {
    raw: {
      width: outlined.width,
      height: outlined.height,
      channels: decoded.info.channels,
    },
  })
    .png({ palette: true, colours: 32, dither: 0 })
    .toBuffer();
  const destination = path.join(PIXEL_OUTPUT_DIR, relativeOutputPath);
  const resolved = path.resolve(destination);
  if (!resolved.startsWith(`${PIXEL_OUTPUT_DIR}${path.sep}`)) {
    throw new Error(`Refusing to write outside ${PIXEL_OUTPUT_DIR}: ${relativeOutputPath}`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, output, { flag: REPLACE_PIXEL_OUTPUTS ? "w" : "wx" });
  const metadata = await sharp(output).metadata();
  return { width: metadata.width, height: metadata.height };
}

async function processPixelAssets() {
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    throw new Error(`${OUTPUT_DIR} is missing; run the original office asset processing first.`);
  }
  try {
    await fs.access(PIXEL_OUTPUT_DIR);
    if (!REPLACE_PIXEL_OUTPUTS) {
      throw new Error(
        `${PIXEL_OUTPUT_DIR} already exists. Use --replace-pixel to replace only generated pixel assets.`,
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(PIXEL_OUTPUT_DIR, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    processing: {
      targetHeight: 48,
      displayHeight: 96,
      resizeKernel: "nearest",
      paletteColors: 32,
      outline: "one-pixel 8-connected dark outline",
      sourceAssetsPreserved: true,
    },
    characters: {},
  };

  for (const character of CHARACTER_SOURCES) {
    const sourceDirectory = path.join(OUTPUT_DIR, character.name);
    const files = (await fs.readdir(sourceDirectory))
      .filter((file) => file.endsWith(".png"))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const poses = [];
    for (const file of files) {
      const source = path.join(sourceDirectory, file);
      const output = `${character.name}/${file}`;
      const size = await writePixelPose(source, output);
      poses.push({ file: output, source: path.relative(OFFICE_DIR, source), ...size });
    }
    manifest.characters[character.name] = { poses };
  }

  const azharFallbacks = {
    sit: "ali/ali-20.png",
    stand: "ali/ali-02.png",
    angry: "ali/ali-02.png",
    success: "ali/ali-02.png",
    walk: "ali/ali-08.png",
    talk: "ali/ali-21.png",
  };
  const azharPoses = {};
  for (const pose of ["sit", "stand", "angry", "success", "walk", "talk"]) {
    const ownerSource = pose === "talk"
      ? path.join(OFFICE_DIR, "characters", "azhar-stand.png")
      : path.join(OFFICE_DIR, "characters", `azhar-${pose}.png`);
    let sourcePath = ownerSource;
    let placeholder = false;
    try {
      await fs.access(ownerSource);
    } catch {
      sourcePath = path.join(OUTPUT_DIR, azharFallbacks[pose]);
      placeholder = true;
    }
    const output = `azhar/azhar-${pose}.png`;
    const size = await writePixelPose(sourcePath, output);
    azharPoses[pose] = {
      file: output,
      source: path.relative(OFFICE_DIR, sourcePath),
      placeholder,
      ...size,
    };
  }
  manifest.characters.azhar.dedicatedPoses = azharPoses;
  const manifestPath = path.join(PIXEL_OUTPUT_DIR, "manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: REPLACE_PIXEL_OUTPUTS ? "w" : "wx",
  });
  console.log(`Created pixelated character poses in ${path.relative(REPO_ROOT, PIXEL_OUTPUT_DIR)}.`);
  for (const [name, character] of Object.entries(manifest.characters)) {
    console.log(`  ${name}: ${character.poses.length} poses`);
  }
  const realAzharPoses = Object.values(azharPoses).filter((pose) => !pose.placeholder).length;
  console.log(`  Azhar dedicated source poses: ${realAzharPoses}/6; missing poses use marked Ali placeholders.`);
  console.log("  manifest.json");
}

function cleanOfficeBackground(data, width, height, channels) {
  const mask = floodMaskFromBorder(width, height, (index) => {
    const offset = index * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return data[offset + 3] > 0 &&
      Math.min(r, g, b) >= 195 &&
      Math.max(r, g, b) - Math.min(r, g, b) <= 16;
  });
  let removedPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * channels;
    if (mask[index]) {
      data[offset + 3] = 0;
      removedPixels += 1;
      continue;
    }
    if (data[offset + 3] === 0) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY) throw new Error("Could not detect the office scene boundary.");
  const padding = 2;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding + 1);
  const bottom = Math.min(height, maxY + padding + 1);
  return {
    data,
    removedPixels,
    crop: {
      left,
      top,
      width: right - left,
      height: bottom - top,
    },
  };
}

async function processOfficeBackground() {
  const source = path.join(OFFICE_DIR, "office-bg.png");
  const decoded = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  const cleaned = cleanOfficeBackground(decoded.data, width, height, channels);
  const { crop } = cleaned;
  const destination = path.join(OUTPUT_DIR, "office-bg-clean.png");
  assertSafeOutputPath(destination);
  const cleanBackground = await sharp(cleaned.data, { raw: { width, height, channels } })
    .extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    })
    .png()
    .toBuffer();
  await writeProcessedFile(destination, cleanBackground);
  return {
    source: "office-bg.png",
    sourceSize: { width, height },
    crop: {
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    },
    removedOuterMarginPixels: cleaned.removedPixels,
    checkerboardAssessment:
      "The checkerboard is confined to the outer margin, not the floor. Border-connected neutral pixels were made transparent and the remaining room was cropped; floor tiles remain unchanged.",
    output: "office-bg-clean.png",
  };
}

async function main() {
  try {
    await fs.access(OUTPUT_DIR);
    if (!REPLACE_GENERATED_OUTPUTS) {
      throw new Error(
        `${OUTPUT_DIR} already exists. Use --replace-processed to replace only files generated by this script.`,
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    processing: {
      targetPoseHeight: 96,
      originalFilesPreserved: true,
      notes: [
        "Pose frames are trimmed connected components, not reconstructed uniform sprite atlases.",
        "96px normalization preserves aspect ratio; source artwork is not converted into pixel art.",
        "Review contact sheets for background-removal artifacts, merged figures, and non-character components.",
      ],
    },
    characters: {},
  };

  for (const character of CHARACTER_SOURCES) {
    console.log(`Processing ${character.name} from ${character.file}...`);
    const result = await writeCharacterSheet(character);
    manifest.characters[character.name] = result;
    console.log(
      `  ${result.sourceSize.width}x${result.sourceSize.height} → ${result.poses.length} poses; ${result.backgroundRemoval.details}`,
    );
    if (result.backgroundRemoval.removedPixels !== undefined) {
      console.log(`  Removed ${result.backgroundRemoval.removedPixels.toLocaleString()} border-connected pixels.`);
    }
  }

  console.log("Inspecting office background margins...");
  manifest.officeBackground = await processOfficeBackground();
  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  assertSafeOutputPath(manifestPath);
  await writeProcessedFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nCreated processed assets in ${path.relative(REPO_ROOT, OUTPUT_DIR)}.`);
  for (const [name, character] of Object.entries(manifest.characters)) {
    console.log(
      `  ${name}: ${character.poses.length} poses, contact-sheet-${name}.png`,
    );
  }
  console.log(
    `  office-bg-clean.png: ${manifest.officeBackground.crop.width}x${manifest.officeBackground.crop.height}, crop at (${manifest.officeBackground.crop.left}, ${manifest.officeBackground.crop.top})`,
  );
  console.log("  manifest.json");
}

const run = PIXEL_ONLY ? processPixelAssets : main;
run().catch((error) => {
  console.error(`Asset processing failed: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
