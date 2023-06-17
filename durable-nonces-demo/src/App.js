import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  useWallet,
  useConnection,
  useAnchorWallet,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import * as anchor from "@coral-xyz/anchor";
import { useMemo, useState } from "react";
import "./App.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  clusterApiUrl,
  PublicKey,
  Transaction,
  Keypair,
  SystemProgram,
  NonceAccount,
  sendAndConfirmRawTransaction,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js'
import React from 'react';
import idl from "./idl.json";
import * as bs58 from "bs58";
import { v4 as uuidv4 } from 'uuid';

const programID = new PublicKey("5MgjVvaSLj6zmxuYhSST1M4LBiXoiSMrJPDZTRPQoiw8");
const network =
  `https://rpc-devnet.helius.xyz/?api-key=${process.env.REACT_APP_HELIUS_API}`;
const opts = {
  preflightCommitment: "processed",
};
const supabase = createClient('https://jduhbkqikqrairwvksmu.supabase.co', process.env.REACT_APP_SUPABASE_KEY)

const nonceAuthKP = Keypair.fromSecretKey(
  bs58.decode(process.env.REACT_APP_AUTH_KEYPAIR)
);

export const getProvider = (wallet) => {
  /* create the provider and return it to the caller */
  /* network set to local network for now */

  const connection = new anchor.web3.Connection(
    network,
    opts.preflightCommitment
  );

  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    opts.preflightCommitment
  );
  return provider;
};

export const getProgram = (wallet) => {
  const provider = getProvider(wallet);
  const program = new anchor.Program(
    idl,
    programID,
    provider
  );

  return program;
};

const Context = ({ children }) => {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

const Content = () => {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [poll, setPoll] = useState(null);
  const [enteredAddress, setEnteredAddress] = useState('');
  const [enteredNumber, setEnteredNumber] = useState(0);
  const [noncePubKeys, setNoncePubKeys] = useState([]);
  const [nonces, setNonces] = useState([]);
  const [votes, setVotes] = useState({
    solana: 0,
    ethereum: 0,
    polygon: 0,
  });
  const wallet = useAnchorWallet();
  const program = getProgram(wallet);
  console.log(`Poll program: ${program.programId}`);
  console.log(`Connected wallet: ${wallet?.publicKey}`);
  console.log(`Poll account: ${poll}`);
  console.log(`Current poll status: Ethereum=${votes.ethereum} | Solana=${votes.solana} | Polygon=${votes.polygon}`);
  console.log(``);

  const fetchPoll = async(pollId) => {
    if (!wallet) {
      return alert("Connect your wallet first.");
    }
    const poll = new PublicKey(pollId);
    const pollAccount = await program.account.poll.fetch(poll);
    console.log(pollAccount);
    setVotes({
      ethereum: parseInt(pollAccount.ethereum.toString()),
      solana: parseInt(pollAccount.solana.toString()),
      polygon: parseInt(pollAccount.polygon.toString()),
    });
    setPoll(new PublicKey(pollId));
  }

  const createNonces = async(num) => {
    const nonceKeypairs = [];
    for(var i = 0; i < num; i++) {
      nonceKeypairs.push(Keypair.generate());
    }
    const tx = new Transaction();
    tx.feePayer = nonceAuthKP.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    for(var j = 0; j < num; j++) {
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: nonceAuthKP.publicKey,
          newAccountPubkey: nonceKeypairs[j].publicKey,
          lamports: 0.0015 * LAMPORTS_PER_SOL,
          space: NONCE_ACCOUNT_LENGTH,
          programId: SystemProgram.programId,
        }),
        SystemProgram.nonceInitialize({
          noncePubkey: nonceKeypairs[j].publicKey,
          authorizedPubkey: nonceAuthKP.publicKey,
        })
      );
    }
    tx.sign(...nonceKeypairs, nonceAuthKP);
    const sig = await sendAndConfirmRawTransaction(connection, tx.serialize({requireAllSignatures: false}));
    console.log("Nonces initiated: ", sig);

    const nonceAccounts = [];
    for(var k = 0; k < num; k++) {
      console.log(nonceKeypairs[k].publicKey.toString());
      let accountInfo = await connection.getAccountInfo(nonceKeypairs[k].publicKey);
      nonceAccounts.push(NonceAccount.fromAccountData(accountInfo.data));
    }
    setNoncePubKeys(nonceKeypairs.map(kp => kp.publicKey));
    setNonces(nonceAccounts.map(acc => acc.nonce))
    alert(`${num} nonces prepared, lets get started!`);
  }

  const createPoll = async () => {
    if (!wallet) {
      return alert("Connect your wallet first.");
    }
    
    const newPoll = anchor.web3.Keypair.generate();

    await program.methods
    .create()
    .accounts({
      poll: newPoll.publicKey,
      user: wallet.publicKey,
    })
    .signers([newPoll])
    .rpc();
    setPoll(newPoll.publicKey);
  };

  const vote = async (candidate) => {
    if (nonces.length === 0) {
      return alert("No more nonces left, create some.");
    }
    if (!wallet) {
      return alert("Connect your wallet first.");
    } else if (!poll) {
      return alert("Create a new poll first.");
    }

    const nonce = nonces.pop();
    const noncePubKey = noncePubKeys.pop();
    setNonces(nonces);
    setNoncePubKeys(noncePubKeys);

    let vote = "";
    if (candidate === 0) {
      vote = "eth";
    } else if (candidate === 1) {
      vote = "sol";
    } else if (candidate === 2) {
      vote = "pol";
    }
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
    const ser = bs58.encode(signedtx.serialize({requireAllSignatures: false}));
    console.log("signed!");

    const row = { id: uuidv4(), transaction: ser, publicKey: publicKey, pollId: poll };
    const { error } = await supabase
      .from('durableTransactions')
      .insert(row);
    
    if (error) {
      console.log(error);
    } else {
      console.log(`inserted row to supabase: ${row}`);
    }
  }

  const countVotes = async() => {
    const { data } = await supabase
      .from('durableTransactions')
      .select('transaction')
      .eq('pollId', poll.toString());

    for (const txObj of data) {
      const tx = bs58.decode(txObj.transaction);
      const sig = await sendAndConfirmRawTransaction(connection, tx);
      console.log("Sent durable transaction: ", sig);
    }

    const { error } = await supabase
      .from('durableTransactions')
      .delete()
      .eq('pollId', poll.toString());
    if (error) {
      console.log("error while deleting txs from supabase");
    } else {
      console.log(`successfully deleted txs for poll: ${poll.toString()}`)
    }
    const pollAccount = await program.account.poll.fetch(poll);
    setVotes({
      ethereum: parseInt(pollAccount.ethereum.toString()),
      solana: parseInt(pollAccount.solana.toString()),
      polygon: parseInt(pollAccount.polygon.toString()),
    });
    console.log(votes)
  };

  return (
    <div className="App">
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 30,
          marginBottom: 30,
        }}
      >
        <WalletMultiButton />
      </div>
      {publicKey ? (
        <>
          <h1>Vote for your favorite blockchain</h1>
          <h3>Enter the Poll address or create a new one</h3>
          <input 
            type="text"
            value={enteredAddress}
            onChange={(event) => setEnteredAddress(event.target.value)} 
          />
          <button onClick={() => fetchPoll(enteredAddress)}>
            Fetch Old Poll
          </button>
          <button onClick={() => createPoll()}>
            Create New Poll
          </button>
          <h3>Enter the number of votes you want to give</h3>
          <input 
            type="text"
            value={enteredNumber}
            onChange={(event) => setEnteredNumber(event.target.value)} 
          />
          <button onClick={() => createNonces(enteredNumber)}>
            Create Nonces
          </button>
          <h3>Vote for your favorite blockchain</h3>
          <button onClick={() => vote(0)}>
            Vote Ethereum
          </button>
          <button onClick={() => vote(1)}>
            Vote Solana
          </button>
          <button onClick={() => vote(2)}>
            Vote Polygon
          </button>
          <h3>Wallet Address</h3>
          <p>
            {publicKey.toString()}
          </p>
          <h3>Poll Address</h3>
          <p>
            {poll ? poll.toString() : ''}
          </p>
          <button onClick={() => countVotes()}>
            Count Votes
          </button>
          <h2>Ethereum: {votes.ethereum} | Solana: {votes.solana} | Polygon: {votes.polygon}</h2>
        </>
      ) : (
        <p>Please connect your wallet</p>
      )}
    </div>
  );
};

const App = () => {
  return (
    <Context>
      <Content />
    </Context>
  );
};
export default App;
