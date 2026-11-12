<script setup lang="ts">
import { ref } from 'vue';
import { MockAdapter } from '@orange-ui/adapters';
import { AddressInput, AmountInput, Checkout, PayButton } from '@orange-ui/vue';

const adapter = new MockAdapter({ scenario: 'onchain', stepMs: 2000 });
const amount = ref<bigint | undefined>(21000n);
const destination = ref('');
const log = ref<string[]>([]);
</script>

<template>
  <main style="max-width: 640px; margin: 0 auto; padding: 2rem 1rem; font-family: system-ui">
    <h1>orange-ui with Vue</h1>

    <AmountInput
      label="Amount"
      :balance="250000n"
      fiat-currency="USD"
      fiat-price="97250"
      @input="(e: CustomEvent) => (amount = e.detail.amount)"
    />
    <PayButton
      :adapter="adapter"
      :amount="amount"
      description="Vue order"
      @paid="log.push('paid!')"
    />

    <h2>Send</h2>
    <AddressInput
      accept="onchain-address,bip21,bolt11,lightning-address"
      @change="(e: CustomEvent) => (destination = e.detail.value)"
    />
    <p v-if="destination">
      Destination: <code>{{ destination }}</code>
    </p>

    <h2>Inline checkout (on-chain confirmations)</h2>
    <Checkout
      :adapter="adapter"
      :amount="30000n"
      @status-change="(e: CustomEvent) => log.push(e.detail.status)"
    />

    <pre>{{ log.join('\n') }}</pre>
  </main>
</template>
