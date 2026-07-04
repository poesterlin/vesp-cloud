<script lang="ts">
  import { Button, Section, Text } from '@better-svelte-email/components';
  import EmailShell from './email-shell.svelte';

  let {
    appName = 'vESP.cloud',
    verificationUrl,
    expiresIn = '10 minutes',
    recipient = 'operator',
  }: {
    appName?: string;
    verificationUrl: string;
    expiresIn?: string;
    recipient?: string;
  } = $props();
</script>

<EmailShell preview={`Confirm your ${appName} email address`} eyebrow="Email verification" title="Confirm your email address">
  <Text class="m-0 text-[16px] leading-[1.7] text-[#374151]">
    Hi {recipient}, we received a request to verify this email address for your {appName} account.
  </Text>

  <Section class="mt-8 rounded-[10px] border border-[#d1d5db] bg-[#f9fafb] px-6 py-6">
    <Text class="m-0 text-[13px] font-medium text-[#1f2937]">Verification link</Text>
    <Button href={verificationUrl} pX={20} pY={12} class="mt-4 inline-block rounded-[8px] bg-[#2563eb] text-[14px] font-semibold text-[#ffffff]">
      Verify email address
    </Button>
    <Text class="mt-5 break-all text-[12px] leading-[1.7] text-[#6b7280]">
      {verificationUrl}
    </Text>
  </Section>

  <Text class="mt-8 text-[14px] leading-[1.7] text-[#374151]">
    This link expires in {expiresIn}. If you did not request email verification, you can safely ignore this message.
  </Text>
</EmailShell>
