import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import camera_encoder, display
from esphome.core.entity_helpers import setup_entity
from esphome.const import CONF_ID

AUTO_LOAD = ["camera"]
DEPENDENCIES = ["esp32", "camera_encoder"]

CONF_DISPLAY_ID = "display_id"
CONF_ENCODER_ID = "encoder_id"

framebuffer_camera_ns = cg.esphome_ns.namespace("framebuffer_camera")
FramebufferCamera = framebuffer_camera_ns.class_(
    "FramebufferCamera", cg.Component, cg.EntityBase
)

CONFIG_SCHEMA = cv.ENTITY_BASE_SCHEMA.extend(
    {
        cv.GenerateID(): cv.declare_id(FramebufferCamera),
        cv.Required(CONF_DISPLAY_ID): cv.use_id(display.Display),
        cv.Required(CONF_ENCODER_ID): cv.use_id(camera_encoder.Encoder),
    }
).extend(cv.COMPONENT_SCHEMA)


async def to_code(config):
    cg.add_define("USE_CAMERA")
    var = cg.new_Pvariable(config[CONF_ID])
    await setup_entity(var, config, "camera")
    await cg.register_component(var, config)

    display_var = await cg.get_variable(config[CONF_DISPLAY_ID])
    encoder_var = await cg.get_variable(config[CONF_ENCODER_ID])
    cg.add(var.set_display(display_var))
    cg.add(var.set_encoder(encoder_var))
