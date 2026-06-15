<script lang="ts">
  import { Button, Section, Text } from '@better-svelte-email/components';
  import EmailShell from './email-shell.svelte';

  let {
    appName = 'Home Display',
    recoveryUrl,
    expiresIn = '15 minutes',
    recipient = 'operator',
  }: {
    appName?: string;
    recoveryUrl: string;
    expiresIn?: string;
    recipient?: string;
  } = $props();
</script>

<EmailShell preview={`Reset your ${appName} password`} eyebrow="Password reset" title="Reset your password" accent="#2563eb">
  <Text class="m-0 text-[16px] leading-[1.7] text-[#374151]">
    Hi {recipient}, we received a request to reset your {appName} account password.
  </Text>

  <Section class="mt-8 rounded-[10px] border border-[#d1d5db] bg-[#f9fafb] px-6 py-6">
    <Text class="m-0 text-[13px] font-medium text-[#1f2937]">Reset link</Text>
    <Button href={recoveryUrl} pX={20} pY={12} class="mt-4 inline-block rounded-[8px] bg-[#2563eb] text-[14px] font-semibold text-[#ffffff]">
      Reset password
    </Button>
    <Text class="mt-5 break-all text-[12px] leading-[1.7] text-[#6b7280]">
      {recoveryUrl}
    </Text>
  </Section>

  <Text class="mt-8 text-[14px] leading-[1.7] text-[#374151]">
    This link expires in {expiresIn}. If you did not request a password reset, you can ignore this message.
  </Text>
</EmailShell>
