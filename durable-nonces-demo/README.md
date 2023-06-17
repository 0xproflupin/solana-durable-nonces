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

If nonces are used in place of recent blockhashes, the first instruction of the transaction needs to be an `AdvanceNonce` instruction, which changes or advances the nonce. This ensures that every transaction which is signed using the nonce as the recent blockhash, irrespective of being successfully submitted or not will be unique.

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

```
solana-keygen new -o nonce-authority.json
```

Set the current Solana CLI keypair to `nonce-authority.json` and airdrop some SOL in it.

```
solana config set -k ~/<path>/nonce-authority.json
solana airdrop 2
```

Okay, we're set. Let's create our nonce account.

### Create Nonce Account
Create a new keypair `nonce-account` and use the `create-nonce-account` instruction to delegate this keypair as the Nonce Account. We will also transfer 0.0015 SOL to the Nonce Account from the Nonce Authority, which is usually just above the minimum quantity needed for rent exemption.

```
solana-keygen new -o nonce-account.json
solana create-nonce-account nonce-account.json 0.0015
```

Output
```
Signature: skkfzUQrZF2rcmrhAQV6SuLa7Hj3jPFu7cfXAHvkVep3Lk3fNSVypwULhqMRinsa6Zj5xjj8zKZBQ1agMxwuABZ
```
Upon searching the [signature](https://solscan.io/tx/skkfzUQrZF2rcmrhAQV6SuLa7Hj3jPFu7cfXAHvkVep3Lk3fNSVypwULhqMRinsa6Zj5xjj8zKZBQ1agMxwuABZ?cluster=devnet) on the explorer, we can see that the Nonce Account was created and the `InitializeNonce` instruction was used to initialise a nonce within the account.

We can get query the value of the stored Nonce as follows.
```
solana nonce nonce-account.json
```

Output
```
AkrQn5QWLACSP5EMT2R1ZHyKaGWVFrDHJ6NL89HKtwjQ
```

This is the 32 bit alphanumeric string that will be used in place of a recent blockhashes while signing a transaction.

### 