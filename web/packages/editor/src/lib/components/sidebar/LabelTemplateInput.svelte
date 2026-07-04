<script lang="ts">
  import CompositeInput from "../CompositeInput.svelte";
  import TemplateHelperModal from "./TemplateHelperModal.svelte";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import type { EntityBinding } from "@vesp-cloud/schema";
  import { mdiCodeBraces } from "@mdi/js";
  import {
    type BindingSegment,
    getBindingDisplay,
    getDomainIcon,
    parseTemplate,
    serializeBinding,
  } from "$lib/utils/template-utils";

  interface Props {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
  }

  let {
    value,
    placeholder = "Enter text...",
    onChange,
  }: Props = $props();

  let templateHelperOpen = $state(false);
  let editingBindingIndex = $state<number | null>(null);
  let inputRefs = $state<HTMLInputElement[]>([]);
  let chipRefs = $state<HTMLButtonElement[]>([]);
  let focusedSegmentIndex = $state(0);
  let containerEl = $state<HTMLElement | null>(null);

  const segments = $derived(parseTemplate(value));

  function getTextPosition(segmentIndex: number): number {
    let pos = 0;
    for (let i = 0; i < segmentIndex; i++) {
      const seg = segments[i];
      if (seg.type === "text") {
        pos += seg.value.length;
      } else {
        pos += serializeBinding(seg.value).length;
      }
    }
    return pos;
  }

  function rebuildText(changedSegmentIndex: number, newText: string): string {
    let result = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.type === "text") {
        result += i === changedSegmentIndex ? newText : seg.value;
      } else {
        result += serializeBinding(seg.value);
      }
    }
    return result;
  }

  function rebuildTextWithoutBinding(bindingSegmentIndex: number): string {
    let result = "";
    for (let i = 0; i < segments.length; i++) {
      if (i === bindingSegmentIndex) continue;
      const seg = segments[i];
      if (seg.type === "text") {
        result += seg.value;
      } else {
        result += serializeBinding(seg.value);
      }
    }
    return result;
  }

  function handleTextChange(segmentIndex: number, newValue: string) {
    const inputEl = inputRefs[segmentIndex];
    const cursor = inputEl?.selectionStart ?? 0;

    // Check for {{ trigger
    if (newValue.slice(0, cursor).endsWith("{{")) {
      const beforeTrigger = newValue.slice(0, cursor - 2);
      const afterTrigger = newValue.slice(cursor);
      const cleanedValue = beforeTrigger + afterTrigger;
      const newText = rebuildText(segmentIndex, cleanedValue);

      focusedSegmentIndex = segmentIndex;
      // We'll insert at the position where {{ was
      const textPos = getTextPosition(segmentIndex);
      const insertPos = textPos + cursor - 2;

      onChange(newText);

      editingBindingIndex = null;
      templateHelperOpen = true;
      return;
    }

    const newText = rebuildText(segmentIndex, newValue);
    onChange(newText);
  }

  function focusSegment(
    index: number,
    position: "start" | "end" | number | "select",
  ) {
    setTimeout(() => {
      const seg = segments[index];
      if (!seg) return;

      if (seg.type === "text") {
        const input = inputRefs[index];
        if (input) {
          input.focus();
          const pos =
            position === "start"
              ? 0
              : position === "end" || position === "select"
                ? input.value.length
                : position;
          input.setSelectionRange(pos, pos);
          focusedSegmentIndex = index;
        }
      } else {
        const chip = chipRefs[index];
        if (chip) {
          chip.focus();
          focusedSegmentIndex = index;
        }
      }
    }, 0);
  }

  function handleKeydown(
    segmentIndex: number,
    e: KeyboardEvent,
    inputEl: HTMLInputElement,
  ) {
    if (e.key === "ArrowLeft" && inputEl.selectionStart === 0) {
      if (segmentIndex > 0) {
        e.preventDefault();
        focusSegment(segmentIndex - 1, "end");
      }
    }

    if (
      e.key === "ArrowRight" &&
      inputEl.selectionEnd === inputEl.value.length
    ) {
      if (segmentIndex < segments.length - 1) {
        e.preventDefault();
        focusSegment(segmentIndex + 1, "start");
      }
    }

    if (
      e.key === "Backspace" &&
      inputEl.selectionStart === 0 &&
      inputEl.selectionEnd === 0
    ) {
      if (segmentIndex > 0 && segments[segmentIndex - 1].type === "binding") {
        e.preventDefault();
        removeBinding(segmentIndex - 1);
      }
    }

    if (
      e.key === "Delete" &&
      inputEl.selectionStart === inputEl.value.length &&
      inputEl.selectionEnd === inputEl.value.length
    ) {
      if (
        segmentIndex < segments.length - 1 &&
        segments[segmentIndex + 1].type === "binding"
      ) {
        e.preventDefault();
        removeBinding(segmentIndex + 1);
      }
    }
  }

  function handleChipKeydown(index: number, e: KeyboardEvent) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      removeBinding(index);
    } else if (e.key === "ArrowLeft") {
      if (index > 0) {
        e.preventDefault();
        focusSegment(index - 1, "end");
      }
    } else if (e.key === "ArrowRight") {
      if (index < segments.length - 1) {
        e.preventDefault();
        focusSegment(index + 1, "start");
      }
    }
  }

  function removeBinding(segmentIndex: number) {
    // Determine where to focus after removal
    let focusIdx = 0;
    let focusPos: "start" | "end" | number = "end";

    if (segmentIndex > 0) {
      focusIdx = segmentIndex - 1;
      focusPos = "end";
    } else if (segmentIndex < segments.length - 1) {
      focusIdx = segmentIndex + 1;
      focusPos = "start";
    }

    const newText = rebuildTextWithoutBinding(segmentIndex);
    onChange(newText);

    // Re-parse to find new segment indices
    const newSegments = parseTemplate(newText);
    if (newSegments.length > 0) {
      const targetIdx = Math.min(newSegments.length - 1, focusIdx);
      focusSegment(targetIdx, focusPos);
    }
  }

  function startEditBinding(segmentIndex: number) {
    editingBindingIndex = segmentIndex;
    templateHelperOpen = true;
  }

  function addBinding(binding: EntityBinding) {
    if (editingBindingIndex !== null) {
      const replacedIndex = editingBindingIndex;
      let result = "";
      for (let i = 0; i < segments.length; i++) {
        if (i === replacedIndex) {
          result += serializeBinding(binding);
        } else {
          const seg = segments[i];
          result +=
            seg.type === "text" ? seg.value : serializeBinding(seg.value);
        }
      }
      onChange(result);
      editingBindingIndex = null;
      templateHelperOpen = false;

      focusSegment(replacedIndex + 1, "start");
      return;
    }

    // Find a suitable text input to insert into. If the user was focused
    // on a chip, prefer the text segment immediately after it so the new
    // binding lands right next to where they were.
    let targetIndex = focusedSegmentIndex;
    if (segments[targetIndex]?.type !== "text") {
      if (segments[targetIndex + 1]?.type === "text") {
        targetIndex = targetIndex + 1;
      } else {
        targetIndex = segments.findLastIndex((s) => s.type === "text");
      }
      if (targetIndex === -1) {
        const bindingStr = serializeBinding(binding);
        const newText = value + bindingStr;
        onChange(newText);
        templateHelperOpen = false;
        return;
      }
    }

    const inputEl = inputRefs[targetIndex];
    const cursor = inputEl?.selectionStart ?? inputEl?.value.length ?? 0;
    const textPos = getTextPosition(targetIndex);
    const insertPos = textPos + cursor;
    const bindingStr = serializeBinding(binding);

    const newText =
      value.slice(0, insertPos) + bindingStr + value.slice(insertPos);
    onChange(newText);
    templateHelperOpen = false;

    // Focus next text segment after insertion
    setTimeout(() => {
      const nextSegments = parseTemplate(newText);
      let currentPos = 0;
      for (let i = 0; i < nextSegments.length; i++) {
        const seg = nextSegments[i];
        const segLen =
          seg.type === "text"
            ? seg.value.length
            : serializeBinding(seg.value).length;
        if (
          currentPos >= insertPos + bindingStr.length &&
          seg.type === "text"
        ) {
          focusSegment(i, "start");
          break;
        }
        currentPos += segLen;
      }
    }, 50);
  }

  function handleContainerClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Clicks on inputs/chips/buttons are handled by their own elements
    if (
      target.tagName === "INPUT" ||
      target.closest("button") ||
      target.closest(".template-chip")
    ) {
      return;
    }

    // Pick the closest text segment to the click x-coordinate so the user
    // can click the gap before, between, or after chips to position the
    // caret naturally.
    const clickX = e.clientX;
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestPos: "start" | "end" = "end";

    for (let i = 0; i < segments.length; i++) {
      if (segments[i].type !== "text") continue;
      const input = inputRefs[i];
      if (!input) continue;
      const rect = input.getBoundingClientRect();

      if (clickX < rect.left) {
        const d = rect.left - clickX;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
          bestPos = "start";
        }
      } else if (clickX > rect.right) {
        const d = clickX - rect.right;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
          bestPos = "end";
        }
      } else {
        bestIdx = i;
        bestPos = "end";
        break;
      }
    }

    if (bestIdx !== -1) {
      focusSegment(bestIdx, bestPos);
    }
  }

  const getEntity = (id: string) => homeAssistantStore.getEntity(id);
</script>

<div
  class="template-input-wrapper"
  bind:this={containerEl}
  onclick={handleContainerClick}
  role="presentation"
>
  <CompositeInput>
    {#each segments as segment, index (index)}
      {#if segment.type === "text"}
        <input
          type="text"
          class="template-text"
          class:is-empty={segment.value === ""}
          value={segment.value}
          placeholder={index === 0 && segments.length === 1 ? placeholder : ""}
          aria-label={index === 0
            ? "Text before content"
            : index === segments.length - 1
              ? "Text after content"
              : "Text between bindings"}
          bind:this={inputRefs[index]}
          oninput={(e) => handleTextChange(index, e.currentTarget.value)}
          onfocus={() => (focusedSegmentIndex = index)}
          onkeydown={(e) => handleKeydown(index, e, e.currentTarget)}
        />
      {:else}
        <div class="chip-wrapper">
          <button
            class="template-chip"
            bind:this={chipRefs[index]}
            onclick={() => startEditBinding(index)}
            onkeydown={(e) => handleChipKeydown(index, e)}
            onfocus={() => (focusedSegmentIndex = index)}
            title={segment.value.entityId +
              (segment.value.attribute ? "." + segment.value.attribute : "")}
          >
            <span class="chip-icon">{getDomainIcon(segment.value)}</span>
            <span class="chip-name">{getBindingDisplay(segment.value, getEntity)}</span>
          </button>
          <button
            class="chip-remove"
            onclick={(e) => {
              e.stopPropagation();
              removeBinding(index);
            }}
            title="Remove binding"
          >
            ✕
          </button>
        </div>
      {/if}
    {/each}
  </CompositeInput>
  <button
    class="composite-action"
    onclick={() => (templateHelperOpen = true)}
    title="Add entity binding"
  >
    <svg class="plus-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={mdiCodeBraces}></path>
    </svg>
  </button>
</div>

{#if templateHelperOpen}
  <TemplateHelperModal
    initialBinding={editingBindingIndex !== null &&
    segments[editingBindingIndex]?.type === "binding"
      ? (segments[editingBindingIndex] as BindingSegment).value
      : undefined}
    onInsert={addBinding}
    onClose={() => {
      templateHelperOpen = false;
      editingBindingIndex = null;
    }}
  />
{/if}

<style>
  .template-input-wrapper {
    display: contents;
  }

  /* Empty text inputs (before/between/after chips) should remain easy to
     click so users can always insert text adjacent to chips. The
     CompositeInput style already enforces a min-width on the input, but
     we add a subtle hover affordance so empty slots are discoverable. */
  .template-text {
    cursor: text;
  }

  .template-text.is-empty:hover {
    background: var(--color-bg-secondary);
    border-radius: 2px;
  }

  .chip-wrapper {
    display: inline-flex;
    align-items: center;
    position: relative;
    flex-shrink: 0;
  }

  .template-chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 5px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 10px;
    font-weight: 500;
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
    transition: all 0.15s;
    height: 20px;
  }

  .template-chip:hover,
  .template-chip:focus {
    background: var(--color-bg-tertiary);
    border-color: var(--color-accent);
    color: var(--color-text-primary);
    outline: none;
  }

  .chip-icon {
    font-size: 10px;
  }

  .chip-name {
    overflow: visible;
  }

  .chip-remove {
    position: absolute;
    right: 1px;
    top: 1px;
    bottom: 1px;
    width: 14px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: 8px;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: all 0.15s;
    z-index: 1;
  }

  .chip-wrapper:hover .chip-remove {
    opacity: 1;
    pointer-events: auto;
  }

  .chip-remove:hover {
    color: #ff5555;
  }

  .composite-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-primary);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .composite-action:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .plus-icon {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }
</style>
