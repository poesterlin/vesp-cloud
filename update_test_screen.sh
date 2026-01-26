#!/bin/bash
set -e

# Configuration - adjust these as needed
DEFAULT_DEVICE="10.0.0.217"  # Your test screen IP for OTA, or /dev/ttyUSB0 for serial
ESPHOME_VENV="${ESPHOME_VENV:-/home/philip/git/home-display/.venv}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <project.zip> [device]"
    echo ""
    echo "Arguments:"
    echo "  project.zip    Path to the exported ESPHome project zip"
    echo "  device         Optional: IP address for OTA or serial port (default: $DEFAULT_DEVICE)"
    echo ""
    echo "Examples:"
    echo "  $0 test.zip                      # Upload via OTA to default device"
    echo "  $0 test.zip 192.168.1.100        # Upload via OTA to specific IP"
    echo "  $0 test.zip /dev/ttyUSB0         # Upload via serial"
    exit 1
}

if [ -z "$1" ]; then
    usage
fi

ZIP_FILE="$1"
DEVICE="${2:-$DEFAULT_DEVICE}"

if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}Error: File not found: $ZIP_FILE${NC}"
    exit 1
fi

if [ ! -d "$ESPHOME_VENV" ]; then
    echo -e "${RED}Error: ESPHome venv not found at $ESPHOME_VENV${NC}"
    echo "Set ESPHOME_VENV environment variable to your esphome virtualenv path"
    exit 1
fi

# Create temp directory
TEMP_DIR=$(mktemp -d -t esphome-upload-XXXXXX)
echo -e "${YELLOW}Extracting to $TEMP_DIR${NC}"

# Cleanup on exit
cleanup() {
    echo -e "${YELLOW}Cleaning up temp directory...${NC}"
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Extract zip
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"

# Config yaml is named after the project (same as zip filename)
PROJECT_NAME=$(basename "$ZIP_FILE" .zip)
CONFIG_FILE="$TEMP_DIR/$PROJECT_NAME.yaml"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: $PROJECT_NAME.yaml not found in zip${NC}"
    exit 1
fi

CONFIG_DIR=$(dirname "$CONFIG_FILE")
echo -e "${GREEN}Found config at: $CONFIG_FILE${NC}"

# Activate venv and set up environment
source "$ESPHOME_VENV/bin/activate"

# Set environment variables (same as queue/index.ts)
export VIRTUAL_ENV="$ESPHOME_VENV"
export PATH="$ESPHOME_VENV/bin:$PATH"
export PYTHONPATH="$ESPHOME_VENV/lib/python3.11/site-packages"
export PLATFORMIO_PENV_NOT_USED="true"
export PLATFORMIO_CORE_DIR="$CONFIG_DIR/.platformio"

echo -e "${YELLOW}Running ESPHome upload to $DEVICE...${NC}"
echo ""

cd "$CONFIG_DIR"

# Run esphome - 'run' compiles and uploads, showing logs after
# Use 'upload' if you only want to upload without logs
python -m esphome run "$CONFIG_FILE" --device "$DEVICE"

echo ""
echo -e "${GREEN}Done!${NC}"
