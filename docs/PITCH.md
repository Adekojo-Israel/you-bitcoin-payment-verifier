# YOU: three-minute pitch

**0:00–0:35: Problem (open Verify, then Demo)**

I’m building YOU for freelancers and small sellers who accept Bitcoin directly. Imagine you design a flyer for a customer in Lagos. The customer sends a screenshot saying “paid” and asks for the final files. A screenshot is not a confirmation. Before you send the files, check if the Bitcoin reached your address in the agreed amount. Then check if it has confirmed. I haven’t yet validated how often sellers face this problem or how they handle it today.

**0:35–1:10: Demo (run short payment, then unconfirmed)**

Here’s an offline practice order: 2,500 sats for flyer design. The buyer says the full amount was sent, but the demo finds 1,500 sats for our receiving address. YOU shows an amount mismatch. Now switch to the right amount, but still unconfirmed. The app shows zero confirmations and asks you to wait and recheck. The demo can also show a wrong address and a confirmed match. All of these examples are synthetic; they don’t touch the network.

**1:10–1:55: Working MVP (load the Signet example, then Receive)**

Now let’s check a real historical Signet transaction. This is not a payment to us. YOU reads public transaction data, compares the output to the specified receiving address, and shows the exact amount, confirmation count, fee, and whether it sees explicit replace-by-fee signalling. Without the transaction ID, YOU shows address history without tying it to this order. I can copy the result or choose Save this check. Nothing saves automatically. A saved check stays in this browser and may be out of date. In Receive, I can generate a test wallet or paste my own address, add an amount and label, and share a locally generated QR. I can also see recent incoming test payments.

**1:55–2:30: Safety (open Send Check and the checklist)**

Send Check is separate from the wallet. It compares a full address with an address I previously saved. A match doesn’t prove who controls it; the checklist reminds me to make an independent check. The generated Signet wallet can also sign a confirmed-balance sweep locally. The app shows the destination and fee before a separate broadcast click. The wallet key stays in this tab and cannot be recovered after a reload. I tested signing and broadcasting against Bitcoin Core regtest, not with a new public Signet transfer. This is not a bank-payment verifier or a production wallet.

**2:30–3:00: Impact and next step (show the project links)**

The next step is to ask Nigerian sellers who have actually accepted Bitcoin how they check payments today, then watch willing participants compare their usual approach with this public example. I want to learn whether they spot wrong payments more reliably and whether the confirmation language makes sense. I’ll report what people actually do, not claim adoption from a demo. Check the Bitcoin payment before you release the files.
