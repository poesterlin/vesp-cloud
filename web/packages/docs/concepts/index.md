# Project concepts

VESP Cloud projects are made from pages, detail views, and widgets. Understanding
how they fit together makes it easier to plan your display before you start
designing.

## Projects

A project contains everything for one display: its pages, detail views, widgets,
Home Assistant connections, timezone, and other settings.

You can create separate projects for displays in different rooms or for
different purposes.

## Dashboard pages

Dashboard pages are the main screens people move between during everyday use.
For example, you might create separate pages for an overview, lighting, climate,
and media controls.

Every project starts with a Home page. You can add more pages, rename them, and
change their order. Buttons can take users to the next or previous page.

## Detail views

Detail views are screens for information or controls that do not need to stay on
a main dashboard page. They work well for a room, device, or task that someone
opens only when needed.

For example, a dashboard page might show the current living-room temperature,
while tapping a button opens a detail view with all of the room's climate
controls. A detail view includes a way to return to the main screens.

Create detail views from the **Detail Views** section of the editor, then connect
them to buttons by choosing **Navigation** and **Open Detail** for the button's
tap action.

## Widgets

Widgets are the individual items placed on a page or detail view. They can show
information, provide controls, add visual structure, or help users move around
the display.

Examples include text, buttons, clocks, lights, weather forecasts, calendars,
images, and to-do lists. Drag widgets from the component palette onto the
display, then use the property editor to change their size, appearance, and
behavior.

See the [Widgets reference](/widgets/) for all available widget types and their
settings.

## Containers

Some widgets organize other widgets:

- **Tabs** place several groups of content in the same area. Users tap a tab to
  switch between them.
- **Conditional areas** show different content based on Home Assistant values,
  the time, or other conditions.

Use containers when related information belongs together or when the available
space needs to serve more than one purpose.

## Home Assistant connections

A widget can be connected to a Home Assistant entity to show current
information or control a device. For example, a light widget can show whether a
light is on and let someone change it from the display.

Importing Home Assistant metadata makes entities and actions easier to find in
the editor. The display connects to Home Assistant after installation to stay up
to date and carry out actions.

## Actions and navigation

Interactive widgets can respond when someone taps them. The two main choices
are:

- **Home Assistant Action** controls a device or starts an action in Home
  Assistant.
- **Navigation** opens a detail view, moves between dashboard pages, or returns
  to the Home screen.

## Notification overlay

The optional notification overlay can show an important message over whichever
screen is currently open. It is useful for alerts such as an open door, an
incoming visitor, or severe weather.

The overlay is shared by the whole project, so it only needs to be configured
once. You can enable it while creating a project or later from **Settings →
Notification Overlay**.

## More concepts

- [Credits & Pricing](./credits) — How the pay-per-build model works
- [Privacy & Data Handling](./privacy) — What data stays local and what goes to the cloud
- [Themes](./themes) — Retro and Modern display themes

[Next: create your first project →](/getting-started/create-project)
