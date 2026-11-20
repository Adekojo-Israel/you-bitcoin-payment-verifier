# YOU: Devpost submission

**Name:** YOU  
**Tagline:** Verify a Bitcoin payment before you release anything.  
**Built with:** Bitcoin Signet, Bitcoin Testnet 4, mempool.space Esplora, BitcoinJS, noble secp256k1, BIP21, JavaScript, HTML and CSS.

## Inspiration

A Nigerian freelancer finishes a job. The buyer sends a payment screenshot and asks for the final files. The seller still needs to check that the right receiving address got the exact Bitcoin amount and that the network has confirmed it. I built YOU as a solo student to make that check easier to understand. The demand hypothesis is unvalidated.

## What it does

YOU compares an expected Bitcoin payment with public data on Signet or Testnet 4. It reports the receiving-address and amount checks, confirmations, fees and any explicit replacement signalling it can detect. With no transaction ID, it shows recent address history without claiming that a specific sale was paid. Sellers can generate a temporary Signet wallet or paste a public receiving address, create a BIP21 request and QR, and see incoming test payments. The temporary wallet can also sign and optionally broadcast a reviewed Signet test sweep. A separate local recipient check and pre-release checklist encourage independent verification. Offline practice covers four synthetic scenarios. The Verify screen has a short guide for a first check. You can copy a result summary or save a snapshot in this browser. Nothing saves automatically. A saved result may be out of date.

## How I built it

YOU is a static app with no backend, account or analytics. BitcoinJS handles scripts, addresses and PSBTs; noble secp256k1 signs locally. Mempool.space provides public test-chain data. Settings and saved recipients stay in this browser. Checks are stored locally only when you choose Save this check. They are not synced. Keys exist only in tab memory, never leave it, and cannot be recovered after a reload. A local build bundles the app into one static HTML file.

## Challenges and accomplishments

An address lookup cannot show whether a specific order was paid. A confirmation is not finality. Saving a recipient does not make that address trustworthy. I tested both public explorers with real historical transactions. An isolated Bitcoin Core regtest test also accepted and mined an actual browser-signed sweep. I did not test a new public Signet faucet-funded transfer or sweep. No real funds were involved.

## What I learned and what’s next

A public example makes a payment checker easy to try, but it says nothing about whether a seller needs it. I’ll ask Nigerian freelancers and sellers how they currently check Bitcoin payments, then test the workflow with consenting participants using public examples or test coins. I’ll measure whether they identify mismatches and interpret confirmations correctly, then report the actual results.

**Public source:** [insert your public GitHub repository]  
**Live MVP:** [insert your deployed URL]  
**Demo video (optional if MVP is accessible):** [insert video URL for this build]

Before submitting: replace placeholders, open all links signed out, and use the [pitch](PITCH.md) to record the final build if needed. The older demo video from the input ZIP depicts an earlier version and is not included as current evidence. Submit by **20 November 2026 at 20:00 UTC (21:00 WAT)**. YOU is an on-chain test-network wallet prototype, not a Lightning or production wallet.
