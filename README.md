# Durable & Offline Transaction Signing using Nonces
This repository is meant to be a one-stop shop for Solana's Durable Nonces: a highly under-utilised and under-appreciated way to power your Solana dapps and make their user experience more reliable and deterministic.

## Introduction to Durable Nonces
### Double Spend
Imagine you're buying an NFT on MagicEden or Tensor. You have to sign a transaction that allows the marketplace's program to extract some SOL from your wallets.

What is stopping them from reusing your signature to extract SOL again? Without a way to check if the transaction was already submitted once, they can keep submitting the signed transaction until there's no SOL left in your wallet.

This is known as the problem of Double-Spend and is one of the core issues that blockchains like Solana solve.

A naive solution could be to crosscheck all transactions made in the past and see if we find the signature there. This is not practically possible, as the size of the Solana ledger is >80 TB.

### Recent Blockhashes
Solution: Crosscheck signatures within only a set period of recent time, and discard the transaction if it gets "too" old.

Recent Blockhashes are used to achieve this. Using recent blockhashes, transactions are checked in the last 150 blocks. If they are found, they are rejected. They are also rejected if they get older than 150 blocks. The only case they are accepted are if they are unique and the blockhash is more recent than 150 blocks (~80-90 seconds).

As you can imagine, a side-effect of using recent blockhashes is the forced mortality of a transaction even before its submission. 

Another issue with blockhashes is the forced non-uniqueness of signed transactions in very small timeframes. In some cases, if the transactions are executed very quickly in succession, some get the same recent blockhashes with high probability, thus [making them duplicate and avoid their execution](https://solana.stackexchange.com/questions/1161/how-to-avoid-sendtransactionerror-this-transaction-has-already-been-processed?rq=1).

To summarise:

1. What if I don't want to send the transaction right away?
2. What if I want to sign the transaction offline as I don't want to keep my keys on a device which is connected to the net?
3. What if I want to co-sign the transaction from multiple devices owned by multiple people, and the co-signing takes more than 90 seconds, like in a case of a multi-sig operated by a DAO?
4. What if I want to sign and send a burst of transactions and don't want them to be fail due to duplication?

The solution lies with Durable Nonces⚡️

### Durable Nonces
Durable Transaction Nonces, which are 32-byte alphanumerics, are used in place of recent blockhashes to make every transaction unique (to avoid double-spending) while removing the mortality on the unexecuted transaction.

How do they make transactions unique to avoid double spending?

If nonces are used in place of recent blockhashes, the first instruction of the transaction needs to be an `nonceAdvance` instruction, which changes or advances the nonce. This ensures that every transaction which is signed using the nonce as the recent blockhash, irrespective of being successfully submitted or not will be unique.

Let's look at a couple of accounts that are important for using using durable nonces with Solana transactions.

### Nonce Account
The Nonce Account is the account which stores the value of the nonce. This account is owned by the `SystemProgram` and is rent free, thus needs to maintain the minimum balance for rent exemption (around 0.0015 SOL).

### Nonce Authority
Nonce authority is the account that controls the Nonce Account. It has the authority to generate a new nonce, advance the nonce or withdraw SOL from the Nonce Account. By default, the account that creates the Nonce Account is delegated as the Nonce Authority, but its possible to transfer the authority onto a keypair account or a PDA.

Now that we know what Durable Nonces are, its time to create some use them to send durable transactions.

> If you do not have the Solana CLI installed, please go through [this](https://docs.solana.com/cli/install-solana-cli-tools) tutorial and set up the CLI and a keypair with some airdropped SOL on devnet

## Durable Nonces with Solana CLI
### Create Nonce Authority
Let's start with creating a new keypair which we will use as our Nonce authority. We can use the keypair currently configured in our Solana CLI, but its better to make a fresh one (make sure you're on devnet).

```console
solana-keygen new -o nonce-authority.json
```

Set the current Solana CLI keypair to `nonce-authority.json` and airdrop some SOL in it.

```console
solana config set -k ~/<path>/nonce-authority.json
solana airdrop 2
```

Okay, we're set. Let's create our nonce account.

### Create Nonce Account
Create a new keypair `nonce-account` and use the `create-nonce-account` instruction to delegate this keypair as the Nonce Account. We will also transfer 0.0015 SOL to the Nonce Account from the Nonce Authority, which is usually just above the minimum quantity needed for rent exemption.

```console
solana-keygen new -o nonce-account.json
solana create-nonce-account nonce-account.json 0.0015
```

Output
```console
Signature: skkfzUQrZF2rcmrhAQV6SuLa7Hj3jPFu7cfXAHvkVep3Lk3fNSVypwULhqMRinsa6Zj5xjj8zKZBQ1agMxwuABZ
```
Upon searching the [signature](https://solscan.io/tx/skkfzUQrZF2rcmrhAQV6SuLa7Hj3jPFu7cfXAHvkVep3Lk3fNSVypwULhqMRinsa6Zj5xjj8zKZBQ1agMxwuABZ?cluster=devnet) on the explorer, we can see that the Nonce Account was created and the `InitializeNonce` instruction was used to initialise a nonce within the account.


### Fetch Nonce
We can query the value of the stored Nonce as follows.
```console
solana nonce nonce-account.json
```

Output
```console
AkrQn5QWLACSP5EMT2R1ZHyKaGWVFrDHJ6NL89HKtwjQ
```

This is the 32 bit alphanumeric string that will be used in place of a recent blockhashes while signing a transaction.

### Displace Nonce Account
We can inspect the details of a Nonce Account in a prettier formated version

```console
solana nonce-account nonce-account.json
```

Output
```console
Balance: 0.0015 SOL
Minimum Balance Required: 0.00144768 SOL
Nonce blockhash: AkrQn5QWLACSP5EMT2R1ZHyKaGWVFrDHJ6NL89HKtwjQ
Fee: 5000 lamports per signature
Authority: 5CZKcm6PakaRWGK8NogzXvj8CjA71uSofKLohoNi4Wom
```

### Advancing Nonce
As discussed before, advancing the Nonce, or changing the value of the nonce is an important step for making subsequent transactions unique. The Nonce Authority needs to sign the transaction with the `nonceAdvance` instruction.

```console
solana new-nonce nonce-account.json
```

Output
```console
Signature: 4nMHnedguiEtHshuMEm3NsuTQaeV8AdcDL6QSndTZLK7jcLUag6HCiLtUq6kv21yNSVQLoFj44aJ5sZrTXoYYeyS
```

If we check the nonce again, the value of the nonce has changed, or advanced.

```console
solana nonce nonce-account.json
```
Output
```console
DA8ynAQTGctqQXNS2RNTGpag6s5p5RcrBm2DdHhvpRJ8
```

### Withdraw from Nonce Account
We transferred 0.0015 SOL when creating the Nonce Account. The Nonce Authority can transfer these funds back to itself, or some other account.

```console
solana withdraw-from-nonce-account nonce-account.json nonce-authority.json 0.0000001
```

Output
```console
Signature: 5zuBmrUpqnubdePHVgzSNThbocruJZLJK5Dut7DM6WyoqW4Qbrc26uCw3nq6jRocR9XLMwZZ79U54HDnGhDJVNfF
```

We can check the status of the Nonce Account after the withdrawal, the balance should have changed.

```console
solana nonce-account nonce-account.json
```

Output
```console
Balance: 0.0014999 SOL
Minimum Balance Required: 0.00144768 SOL
Nonce blockhash: DA8ynAQTGctqQXNS2RNTGpag6s5p5RcrBm2DdHhvpRJ8
Fee: 5000 lamports per signature
Authority: 5CZKcm6PakaRWGK8NogzXvj8CjA71uSofKLohoNi4Wom
```

## Live Example: DAO Offline Co-Signing
Before we try to sign and send a durable transaction, let's see how transactions are sumbitted using blockhashes. 

We will use an example where a DAO committee needs to transfer some SOL to a new wallet. Two co-signers are needed before sending the SOL, where `co-sender` pays for the transaction and `sender` sends the SOL. To add to this, the `co-sender` is very careful when it comes to connecting his device to the internet, and thus wants to sign the transaction offline.

Let's create three new keypairs which will act as the two members of the DAO, and the receiver. Although for this example we are creating the keypairs in the same system, we will assume that these accounts are on different systems to replicate an IRL scenario.

```console
solana-keygen new -o sender.json
// pubkey: H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51

solana-keygen new -o co-sender.json
// pubkey: HDx43xY4piU3xMxNyRQkj89cqiF15hz5FVW9ergTtZ7S

solana-keygen new -o receiver.json
// pubkey: D3RAQxwQBhMLum2WK7eCn2MpRWgeLtDW7fqXTcqtx9uC
```

Let's add some SOL to the the member wallets.

```console
solana airdrop -k sender.json 0.5
solana airdrop -k co-sender.json 0.5
```

The first step is to build a transfer transaction from `sender` to `reciever` and sign it with `co-sender`'s wallet.

To sign an offline transaction, we need to use:
1. `--sign-only`: which prevents clients from sending the transaction.
2. `--blockhash`: which lets us specify a recent blockhash so that the client does not try to fetch for it in an offline setting.

- We can get a recent blockhash from [solscan](https://solscan.io/blocks?cluster=devnet). Just copy the first blockhash from the list.
- We will also need the pubkey of `sender`: `H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51`
- You can even turn off your internet when you sign this transaction using the `co-sender`'s wallet :).

```console
solana transfer receiver.json 0.1 \
  --sign-only \
  --blockhash F13BkBgNTyyuruUQFSgUkXPMJCfPvKhhrr217eiqGfVE \
  --fee-payer co-sender.json \
  --from H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51 \
  --keypair co-sender.json
```

Output
```console
Blockhash: F13BkBgNTyyuruUQFSgUkXPMJCfPvKhhrr217eiqGfVE
Signers (Pubkey=Signature):
 HDx43xY4piU3xMxNyRQkj89cqiF15hz5FVW9ergTtZ7S=2gUmcb4Xwm3Dy9xH3a3bePsWVKCRMtUghqDS9pnGZDmX6hqtWMfpubEbgcai5twncoAJzyr9FRn3yuXVeSvYD4Ni
Absent Signers (Pubkey):
 H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51
```

The transaction is signed by `co-sender`'s wallet who will pay the tx fee. Also, we are notified about the pending signature from the `sender`'s wallet (`H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51`).

In a real world scenario, `co-sender` can share their `Pubkey=Signature` pair with the `sender` who will need this sign and submit the transaction. This share may take more than a minute to happen. Once the `sender` receives this pair, they can initiate the transfer.

```console
solana transfer receiver.json 0.1 \
  --allow-unfunded-recipient \
  --blockhash F13BkBgNTyyuruUQFSgUkXPMJCfPvKhhrr217eiqGfVE \
  --from sender.json \
  --keypair sender.json \
  --signer HDx43xY4piU3xMxNyRQkj89cqiF15hz5FVW9ergTtZ7S=2gUmcb4Xwm3Dy9xH3a3bePsWVKCRMtUghqDS9pnGZDmX6hqtWMfpubEbgcai5twncoAJzyr9FRn3yuXVeSvYD4Ni
```

Output
```console
Error: Hash has expired F13BkBgNTyyuruUQFSgUkXPMJCfPvKhhrr217eiqGfVE
```

The transfer is not successful because the hash has expired. How do we overcome this issue of expired blockhashes? Using Durable Nonces!

We will use the `nonce-account.json` and `nonce-authority.json` keypairs that we created earlier. We already have a nonce initialised in the `nonce-account`. Let's advance it to get a new one first, just to be sure that the `nonce` isn't already used.


```console
solana new-nonce nonce-account.json
solana nonce-account nonce-account.json
```

Output
```console
Signature: 3z1sSU7fmdRoBZynVLiJEqa97Ja481nb3r1mLu8buAgwMnaKdF4ZaiBkzrLjPRzn1HV2rh4AHQTJHAQ3DsDiYVpF

Balance: 0.0014999 SOL
Minimum Balance Required: 0.00144768 SOL
Nonce blockhash: HNUi6La2QpGJdfcAR6yFFmdgYoCvFZREkve2haMBxXVz
Fee: 5000 lamports per signature
Authority: 5CZKcm6PakaRWGK8NogzXvj8CjA71uSofKLohoNi4Wom
```

Perfect, now let's start with offline co-signing the transaction with `co-signer`'s wallet, but this time, we'll use the `Nonce blockhash` printed above, which is basically the `nonce` stored in the `nonce-account` as the blockhash for the transfer transaction.

```console
solana transfer receiver.json 0.1 \
  --sign-only \
  --nonce nonce-account.json \
  --blockhash HNUi6La2QpGJdfcAR6yFFmdgYoCvFZREkve2haMBxXVz \
  --fee-payer co-sender.json \
  --from H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51 \
  --keypair co-sender.json
```

Output
```console
Blockhash: HNUi6La2QpGJdfcAR6yFFmdgYoCvFZREkve2haMBxXVz
Signers (Pubkey=Signature):
 HDx43xY4piU3xMxNyRQkj89cqiF15hz5FVW9ergTtZ7S=5tfuPxsXchbVFU745658nsQr5Gqhb5nRnZKLnnovJ2PZBHbqUbe7oB5kDbnq7tjeJ2V8Mywa4gujUjT4BWKRcAdi
Absent Signers (Pubkey):
 H8BHbivzT4DtJxL4J4X53CgnqzTUAEJfptSaEHsCvg51
```

This is very similar to the one we signed using the recent blockhash. Now we'll sign and send the transaction with the `sender`'s wallet.

```console
solana transfer receiver.json 0.1 \
  --nonce nonce-account.json \
  --nonce-authority nonce-authority.json \
  --blockhash HNUi6La2QpGJdfcAR6yFFmdgYoCvFZREkve2haMBxXVz \
  --from sender.json \
  --keypair sender.json \
  --signer HDx43xY4piU3xMxNyRQkj89cqiF15hz5FVW9ergTtZ7S=5tfuPxsXchbVFU745658nsQr5Gqhb5nRnZKLnnovJ2PZBHbqUbe7oB5kDbnq7tjeJ2V8Mywa4gujUjT4BWKRcAdi
```

Output
```console
Signature: anQ8VtQgeSMoKTnQCubTenq1J7WKxAa1dbFMDLsbDWgV6GGL135G1Ydv4QTNd6GptP3TxDQ2ZWi3Y5qnEtjM7yg
```

The transaction is successfully submitted!

If we check it on the [explorer](https://solscan.io/tx/anQ8VtQgeSMoKTnQCubTenq1J7WKxAa1dbFMDLsbDWgV6GGL135G1Ydv4QTNd6GptP3TxDQ2ZWi3Y5qnEtjM7yg?cluster=devnet), we can see that an instruction, `AdvanceNonce` was prepended to the transaction, as we discussed before. This is done to avoid using the same nonce again.

Voila, we've gone through a very real-life use case of Durable Nonces. Now let's see how to use them in transactions using JavaScript.

## Durable Nonces with Solana `web3.js`
We'll use a similar example of making a simple transfer to demonstrate how to send transactions using durable nonces.

### Create Nonce Authority
```JS
const nonceAuthKP = Keypair.generate();
// airdrop some SOL into this account from https://solfaucet.com/
```
### Create Nonce Accounts

```JS
const nonceKeypair = Keypair.generate();
const tx = new Transaction();

// the fee payer can be any account
tx.feePayer = nonceAuthKP.publicKey;

// to create the nonce account, you can use fetch the recent blockhash
// or use a nonce from a different, pre-existing nonce account
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

tx.add(
    // create system account with the minimum amount needed for rent exemption.
    // NONCE_ACCOUNT_LENGTH is the space a nonce account takes
    SystemProgram.createAccount({
        fromPubkey: nonceAuthKP.publicKey,
        newAccountPubkey: nonceKeypairs[j].publicKey,
        lamports: 0.0015 * LAMPORTS_PER_SOL,
        space: NONCE_ACCOUNT_LENGTH,
        programId: SystemProgram.programId,
    }),
    // initialise nonce with the created nonceKeypair's pubkey as the noncePubkey
    // also specify the authority of the nonce account
    SystemProgram.nonceInitialize({
        noncePubkey: nonceKeypairs[j].publicKey,
        authorizedPubkey: nonceAuthKP.publicKey,
    })
);

// sign the transaction with both the nonce keypair and the authority keypair
tx.sign(nonceKeypair, nonceAuthKP);

// send the transaction
const sig = await sendAndConfirmRawTransaction(
    connection,
    tx.serialize({requireAllSignatures: false})
);
console.log("Nonce initiated: ", sig);
```

### Fetch Initialised Nonce Account
```JS
const accountInfo = await connection.getAccountInfo(nonceKeypair.publicKey);
const nonceAccount = NonceAccount.fromAccountData(accountInfo.data);
const nonce = nonceAccount.nonce;
```

### Sign Transaction using Durable Nonce
```JS
const ix = program.instruction.vote(vote, {
    accounts: {
    poll: poll,
    user: wallet.publicKey,
    }
});
const advanceIX = SystemProgram.nonceAdvance({
    authorizedPubkey: nonceAuthKP.publicKey,
    noncePubkey: noncePubKey
})
const tx = new Transaction();
tx.add(advanceIX);
tx.add(ix);

tx.recentBlockhash = nonce;
tx.feePayer = publicKey;
tx.sign(nonceAuthKP);
const signedtx = await signTransaction(tx);
```