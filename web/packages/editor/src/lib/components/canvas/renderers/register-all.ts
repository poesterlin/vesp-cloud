import { registerRenderer } from './renderer-registry';

import TextRenderer from './TextRenderer.svelte';
import DigitalClockRenderer from './DigitalClockRenderer.svelte';
import ButtonRenderer from './ButtonRenderer.svelte';
import IconRenderer from './IconRenderer.svelte';
import RectangleRenderer from './RectangleRenderer.svelte';
import ImageRenderer from './ImageRenderer.svelte';
import TodoListRenderer from './TodoListRenderer.svelte';
import LightStateRenderer from './LightStateRenderer.svelte';
import HvacRenderer from './HvacRenderer.svelte';
import ConditionalAreaRenderer from './ConditionalAreaRenderer.svelte';
import TabContainerRenderer from './TabContainerRenderer.svelte';
import ComponentRenderer from './ComponentRenderer.svelte';

registerRenderer('text', TextRenderer);
registerRenderer('digital_clock', DigitalClockRenderer);
registerRenderer('button', ButtonRenderer);
registerRenderer('icon', IconRenderer);
registerRenderer('rectangle', RectangleRenderer);
registerRenderer('image', ImageRenderer);
registerRenderer('todo_list', TodoListRenderer);
registerRenderer('light_state', LightStateRenderer);
registerRenderer('hvac', HvacRenderer);
registerRenderer('conditional_area', ConditionalAreaRenderer);
registerRenderer('tab_container', TabContainerRenderer);
registerRenderer('__component_renderer__', ComponentRenderer);
