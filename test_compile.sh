#!/bin/bash
set -e

# Create minimal test project config
cat > /tmp/test_project.json << 'JSONEOF'
{
  "version": "1.0.1",
  "id": "test-display",
  "name": "Test Display",
  "display": {
    "width": 240,
    "height": 320,
    "platform": "st7789"
  },
  "dashboardPages": [
    {
      "id": "page-1",
      "name": "Status",
      "components": []
    }
  ],
  "detailViews": []
}
JSONEOF

echo "✓ Test project created"
cat /tmp/test_project.json
