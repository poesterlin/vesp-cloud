<script lang="ts">
  import { Body, Container, Head, Html, Preview, Section, Text } from '@better-svelte-email/components';

  let {
    preview,
    eyebrow,
    title,
    accent = '#2563eb',
    children,
  }: {
    preview: string;
    eyebrow: string;
    title: string;
    accent?: string;
    children: import('svelte').Snippet;
  } = $props();
</script>

<Html>
  <Head>
    <style>
      body {
        margin: 0;
        background: #f3f4f6;
      }
    </style>
  </Head>

  <Body class="bg-[#f3f4f6] px-0 py-0 font-sans text-[#111827]">
    <Preview preview={preview} />

    <Container class="mx-auto max-w-[640px] px-4 py-8">
      <Section class="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-[#ffffff] shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
        <Section class="border-b border-[#e5e7eb] px-8 py-6">
          <Text class="m-0 text-[12px] font-semibold" style={`color:${accent}`}>
            {eyebrow}
          </Text>
          <Text class="mt-3 text-[28px] leading-[1.2] font-semibold text-[#111827]">{title}</Text>
        </Section>

        <Section class="px-8 py-8">
          {@render children()}
        </Section>

        <Section class="border-t border-[#e5e7eb] px-8 py-6">
          <Text class="m-0 text-[12px] leading-[1.7] text-[#6b7280]">This email was sent automatically. If you were not expecting it, you can ignore it.</Text>
        </Section>
      </Section>
    </Container>
  </Body>
</Html>
