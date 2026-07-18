<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import { historyStore } from "$lib/stores/history.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import ColorPicker from "../ColorPicker.svelte";
  import EntityPicker from "../EntityPicker.svelte";
  import IconSearcher from "../IconSearcher.svelte";
  import LabelTemplateInput from "../LabelTemplateInput.svelte";

  let { component, updateProperty } = $props<{
    component: Component;
    updateProperty: (key: string, value: unknown) => void;
  }>();

  const imageSource = $derived.by<"static" | "ha">(() => {
    if (component.type !== "image") return "static";
    if (component.imageSource) return component.imageSource;
    if (component.imageBinding?.entityId) return "ha";
    return "static";
  });

  function updateTextContent(text: string) {
    historyStore.record("Update text content");
    projectStore.updateComponent(component.id, {
      text,
      textBinding: undefined,
    });
  }

  function updateImageSource(source: "static" | "ha") {
    if (component.type !== "image") return;
    historyStore.record("Update image source");
    if (source === "static") {
      projectStore.updateComponent(component.id, {
        imageSource: "static",
        imageBinding: undefined,
      });
      return;
    }
    projectStore.updateComponent(component.id, {
      imageSource: "ha",
      file: "",
    });
  }
</script>

{#if component.type === "text"}
  <div class="property-section">
    <label class="section-label">Text</label>
    <div class="field">
      <span class="field-label">Content</span>
      <LabelTemplateInput
        value={component.text ?? ""}
        onChange={updateTextContent}
      />
    </div>
    <div class="field">
      <span class="field-label">Size</span>
      <select
        value={component.fontSize ?? "medium"}
        onchange={(e) => updateProperty("fontSize", e.currentTarget.value)}
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </div>
    <div class="field">
      <span class="field-label">Align</span>
      <select
        value={component.align ?? "left"}
        onchange={(e) => updateProperty("align", e.currentTarget.value)}
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </select>
    </div>
  </div>
  <div class="property-section">
    <label class="section-label">Styling</label>
    <ColorPicker
      label="Text Color"
      value={component.color}
      onUpdate={(color) => updateProperty("color", color)}
    />
  </div>
{/if}

{#if component.type === "digital_clock"}
  <div class="property-section">
    <label class="section-label">Digital Clock</label>
    <ColorPicker
      label="Clock Color"
      value={component.color}
      onUpdate={(color) => updateProperty("color", color)}
    />
  </div>
{/if}

{#if component.type === "button"}
  <div class="property-section">
    <label class="section-label">Button</label>
    <div class="field">
      <span class="field-label">Label</span>
      <input
        type="text"
        value={component.label ?? ""}
        oninput={(e) => updateProperty("label", e.currentTarget.value)}
      />
    </div>
    <div class="field">
      <span class="field-label">Icon</span>
      <IconSearcher
        value={component.icon ?? ""}
        onSelect={(icon) => updateProperty("icon", icon)}
      />
    </div>
    <label class="confirmation-field">
      <input
        type="checkbox"
        checked={component.confirmBeforeAction ?? false}
        onchange={(e) => updateProperty("confirmBeforeAction", e.currentTarget.checked)}
      />
      <span>Require confirmation</span>
    </label>
  </div>
  <div class="property-section">
    <label class="section-label">Styling</label>
    <ColorPicker
      label="Border"
      value={component.borderColor}
      onUpdate={(color) => updateProperty("borderColor", color)}
    />
  </div>
{/if}

{#if component.type === "icon"}
  <div class="property-section">
    <label class="section-label">Icon</label>
    <div class="field">
      <span class="field-label">Icon</span>
      <IconSearcher
        value={component.icon ?? ""}
        onSelect={(icon) => updateProperty("icon", icon)}
      />
    </div>
  </div>
  <div class="property-section">
    <label class="section-label">Styling</label>
    <ColorPicker
      label="Color"
      value={component.color}
      onUpdate={(color) => updateProperty("color", color)}
    />
  </div>
{/if}

{#if component.type === "rectangle"}
  <div class="property-section">
    <label class="section-label">Styling</label>
    <ColorPicker
      label="Background"
      value={component.backgroundColor}
      onUpdate={(color) => updateProperty("backgroundColor", color)}
    />
  </div>
{/if}

{#if component.type === "image"}
  <div class="property-section">
    <div class="section-label">Image</div>
    <div class="field">
      <span class="field-label">Source</span>
      <select
        value={imageSource}
        onchange={(e) => {
          if (e.currentTarget.value === "ha") {
            updateImageSource("ha");
          } else {
            updateImageSource("static");
          }
        }}
      >
        <option value="static">Static file / URL</option>
        <option value="ha">Home Assistant entity</option>
      </select>
    </div>

    {#if imageSource === "ha"}
      <div class="field-group">
        <label class="group-label">Home Assistant Image</label>
        <EntityPicker
          preselectedDomain="image"
          component={component}
          onUpdate={(binding) => updateProperty("imageBinding", binding)}
        />
        <br />
      </div>
    {:else}
      <div class="field">
        <span class="field-label">File</span>
        <input
          type="text"
          value={component.file ?? ""}
          placeholder="images/photo.png"
          oninput={(e) => updateProperty("file", e.currentTarget.value)}
        />
      </div>
    {/if}

    <details class="advanced-details">
      <summary class="advanced-summary">Advanced</summary>
      <p class="advanced-note">
        These defaults work for most cases. Adjust only if your image doesn't
        display correctly.
      </p>
      <div class="field">
        <span class="field-label">Type</span>
        <select
          value={component.image_type ?? "RGB565"}
          onchange={(e) => updateProperty("image_type", e.currentTarget.value)}
        >
          <option value="BINARY">Binary</option>
          <option value="GRAYSCALE">Grayscale</option>
          <option value="RGB565">RGB565</option>
          <option value="RGB">RGB</option>
        </select>
      </div>
      <div class="field">
        <span class="field-label">Resize</span>
        <input
          type="text"
          value={component.resize ??
            `${component.size?.width ?? 100}x${component.size?.height ?? 100}`}
          placeholder="100x100"
          oninput={(e) => updateProperty("resize", e.currentTarget.value)}
        />
      </div>
    </details>
  </div>
{/if}
