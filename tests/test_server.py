import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from pathlib import Path

from server import create_server


class ProspectApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "prospects.sqlite3"
        self.server = create_server(port=0, database_path=self.database_path)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp_dir.cleanup()

    def request(self, method, path, payload=None):
        connection = HTTPConnection(self.host, self.port, timeout=3)
        body = None if payload is None else json.dumps(payload)
        headers = {"Content-Type": "application/json"} if body is not None else {}
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        content = response.read()
        connection.close()
        return response.status, json.loads(content) if content else None

    def test_get_returns_clearly_marked_demo_prospects(self):
        status, prospects = self.request("GET", "/api/prospects")
        self.assertEqual(status, 200)
        self.assertEqual(len(prospects), 12)
        self.assertTrue(all(prospect["isDemo"] for prospect in prospects))

    def test_post_persists_user_prospect_and_marks_it_non_demo(self):
        status, prospect = self.request(
            "POST",
            "/api/prospects",
            {
                "name": "Cedar House Studio",
                "category": "Interior design",
                "city": "Portland, OR",
                "email": "hello@cedar.example",
            },
        )
        self.assertEqual(status, 201)
        self.assertFalse(prospect["isDemo"])
        self.assertEqual(prospect["status"], "new")

        self.restart_server()
        get_status, prospects = self.request("GET", "/api/prospects")
        stored = next(item for item in prospects if item["id"] == prospect["id"])
        self.assertEqual(get_status, 200)
        self.assertEqual(stored["name"], "Cedar House Studio")
        self.assertFalse(stored["isDemo"])

    def test_post_rejects_missing_required_fields(self):
        status, response = self.request(
            "POST", "/api/prospects", {"name": "Missing details"}
        )
        self.assertEqual(status, 400)
        self.assertIn("category is required", response["error"])

    def test_post_rejects_invalid_email_and_non_string_fields(self):
        base = {"name": "Business", "category": "Cafe", "city": "Portland"}
        status, response = self.request(
            "POST", "/api/prospects", {**base, "email": "not-an-email"}
        )
        self.assertEqual(status, 400)
        self.assertIn("valid email", response["error"])

        status, response = self.request(
            "POST", "/api/prospects", {**base, "name": 123}
        )
        self.assertEqual(status, 400)
        self.assertIn("name must be a string", response["error"])

    def test_status_endpoint_validates_and_persists_allowed_values(self):
        _, prospects = self.request("GET", "/api/prospects")
        prospect_id = prospects[0]["id"]

        status, response = self.request(
            "PATCH", f"/api/prospects/{prospect_id}/status", {"status": "not-a-status"}
        )
        self.assertEqual(status, 400)
        self.assertIn("status must be one of", response["error"])

        status, updated = self.request(
            "PATCH", f"/api/prospects/{prospect_id}/status", {"status": "contacted"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["status"], "contacted")

        self.restart_server()
        _, prospects = self.request("GET", "/api/prospects")
        stored = next(item for item in prospects if item["id"] == prospect_id)
        self.assertEqual(stored["status"], "contacted")

    def test_status_endpoint_returns_not_found_for_unknown_prospect(self):
        status, response = self.request(
            "PATCH", "/api/prospects/999999/status", {"status": "replied"}
        )
        self.assertEqual(status, 404)
        self.assertEqual(response["error"], "Prospect not found.")

    def restart_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.server = create_server(port=0, database_path=self.database_path)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.host, self.port = self.server.server_address


if __name__ == "__main__":
    unittest.main()
