# Contributing to ESPHome Display Notifications

## Development Setup

### Environment
- Python 3.9+
- Home Assistant dev environment
- ESPHome configured

### Installing for Development

```bash
# Clone the repository
git clone <your-fork-url>
cd home-display

# Create a symlink to your Home Assistant config
ln -s $(pwd)/custom_components/esphome_display ~/.homeassistant/custom_components/esphome_display
```

### Testing

```bash
# Validate Home Assistant config
hass -c ~/.homeassistant --script check_config

# Run linter
python -m pylint custom_components/esphome_display

# Run type checker
python -m mypy custom_components/esphome_display
```

## Code Style

- Follow [Black](https://github.com/psf/black) formatting
- Use type hints for all functions
- Add docstrings to classes and public methods

```python
def handle_notify_service(call: ServiceCall) -> None:
    """Handle the notify service call.
    
    Args:
        call: The service call with parameters
    """
```

## Testing Changes

1. **Restart Home Assistant** after code changes
2. **Check the logs** for errors:
   ```
   Settings → System → Logs
   ```
3. **Validate YAML** before testing:
   ```yaml
   # Correct format for testing
   esphome_display:
     devices:
       - name: test_display
         esphome_device: test_device
   ```

## File Structure

```
custom_components/esphome_display/
├── __init__.py          # Main integration logic
├── services.yaml        # Service definitions
├── manifest.json        # Integration metadata
├── py.typed             # Type checking marker
├── README.md            # User documentation
├── CONTRIBUTING.md      # This file
└── strings.json         # (Optional) Localization strings
```

## Making Changes

### Adding a New Feature

1. Update `__init__.py` with new logic
2. Update `services.yaml` with service parameter docs
3. Test with Home Assistant
4. Update `README.md` with usage examples
5. Submit a PR with clear description

### Improving Documentation

1. Edit `README.md` or `CONTRIBUTING.md`
2. Run spell check and formatting
3. Ensure examples are accurate
4. Submit a PR

## Common Tasks

### Updating Service Definition

1. Modify `services.yaml`
2. Restart Home Assistant
3. The service will auto-reload

### Adding Device Validation

```python
# In __init__.py
if device_name not in devices:
    _LOGGER.error(f"Device '{device_name}' not found")
    return
```

### Adding Logging

```python
import logging

_LOGGER = logging.getLogger(__name__)

_LOGGER.debug("Debug message")
_LOGGER.info("Info message")
_LOGGER.error("Error message")
```

## Testing with Multiple Devices

```yaml
# configuration.yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen
    - name: bedroom_display
      esphome_device: bedroom_screen
    - name: office_display
      esphome_device: office_screen
```

Then test each device:

```yaml
service: esphome_display.notify
data:
  device: kitchen_display
  message: "Test to kitchen"
```

## Debugging Tips

### Enable Debug Logging

```yaml
# configuration.yaml
logger:
  logs:
    custom_components.esphome_display: debug
```

### Common Issues

1. **Service not found**: Restart Home Assistant after code changes
2. **Device not recognized**: Check device name in config
3. **Type errors**: Run mypy to catch type issues early

## Future Enhancements

Consider these areas for improvement:

- [ ] Notification queuing system
- [ ] Interactive action buttons
- [ ] Severity-based themes
- [ ] Dismissal event handling
- [ ] Response tracking for automations
- [ ] Persistent notification history (optional)
- [ ] Localization support (strings.json)

## Questions?

Open an issue on GitHub with:
- What you're trying to do
- What you've tried
- Error messages or logs
- Home Assistant version

## License

By contributing, you agree to license your changes under the same license as the project.
