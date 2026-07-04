<script lang="ts">
  import { Section, Text } from '@better-svelte-email/components';
  import EmailShell from './email-shell.svelte';

  let {
    orderId,
    confirmedAt,
    creditsPurchased,
    amountPaid,
    supportEmail = 'support@vesp-cloud.com',
  }: {
    orderId: string;
    confirmedAt: string;
    creditsPurchased: number;
    amountPaid: number;
    supportEmail?: string;
  } = $props();

  const confirmedDate = $derived(new Date(confirmedAt));
  const formattedUtc = $derived(confirmedDate.toUTCString());
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  });
</script>

<EmailShell
  preview="Your withdrawal request has been received"
  eyebrow="Contract withdrawal"
  title="Withdrawal confirmation"
  accent="#2563eb"
>
  <Text class="m-0 text-[16px] leading-[1.7] text-[#374151]">
    We received your request to withdraw from your credit pack purchase. This email confirms that your withdrawal was submitted successfully.
  </Text>

  <Section class="mt-8 rounded-[10px] border border-[#d1d5db] bg-[#f9fafb] px-6 py-6">
    <Text class="m-0 text-[13px] font-medium text-[#1f2937]">Order details</Text>
    <Text class="mt-3 text-[14px] leading-[1.7] text-[#374151]">
      <strong>Order ID:</strong> {orderId}
    </Text>
    <Text class="mt-2 text-[14px] leading-[1.7] text-[#374151]">
      <strong>Withdrawal submitted:</strong> {formattedUtc} (UTC)
    </Text>
    <Text class="mt-2 text-[14px] leading-[1.7] text-[#374151]">
      <strong>Purchase:</strong> {creditsPurchased} build credits ({currency.format(amountPaid)})
    </Text>
  </Section>

  <Text class="mt-8 text-[14px] leading-[1.7] text-[#374151]">
    <strong>What happens next</strong><br />
    We will review your withdrawal and process any applicable refund. Refunds typically take a few business days to appear on your original payment method once approved.
  </Text>

  <Text class="mt-6 text-[14px] leading-[1.7] text-[#374151]">
    If you have questions, contact us at <a href="mailto:{supportEmail}">{supportEmail}</a>.
  </Text>
</EmailShell>
