import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  createAssociatedTokenAccountIfNotExist,
  createMintPair,
  createMarket,
  getAssociatedPoolKeys,
  getMarket,
  sleep,
} from "./util";

import { AmmProxy } from "../target/types/amm_proxy";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";

// //4jqQQ61Pkxh7f2Gma4Kqf66iNzxcMCxkx7hPK4tepqF8
// const market = Keypair.fromSecretKey(
//   bs58.decode(
//     "3WawKsMtXLTDoreSgo7uNjVvX2NfrCA66pHN6tPuxfzUiLEzHhX6aPWLHCZcatvzPhkXJX5HVyKYJp4CiyD2HJFU"
//   )
// );

const market = new Keypair();
const globalInfo = {
  marketProgram: new PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
  ammProgram: new PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"),
  ammCreateFeeDestination: new PublicKey(
    "3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"
  ),
  market,
};

// const globalInfo = {
//   marketProgram: new PublicKey("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"),
//   ammProgram: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
//   ammCreateFeeDestination: new PublicKey(
//     "7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5"
//   ),
//   market,
// };

const confirmOptions = { preflightCommitment: "confirmed" };

function getFutureUnixTimestamp(minutes: number): number {
  const now = Date.now(); // Current time in milliseconds
  const futureTime = now + minutes * 60 * 1000; // Add minutes in milliseconds
  return Math.floor(futureTime / 1000); // Convert to Unix timestamp (seconds)
}

async function sendTx(tx: Transaction) {
  const connection = anchor.getProvider().connection;
  tx.recentBlockhash = (
    await connection.getLatestBlockhash("finalized")
  ).blockhash;
  const txId = await anchor
    .getProvider()
    .connection.sendRawTransaction(tx.serialize());
  const confirmation = await connection.confirmTransaction(txId, "confirmed");
  if (confirmation.value.err) {
    throw Error("ERROR");
  }
  return txId;
}

describe("amm-proxy", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;
  const program = anchor.workspace.AmmProxy as Program<AmmProxy>;
  const marketId = globalInfo.market.publicKey.toString();
  console.log("market:", marketId.toString());
  it("amm anchor test!", async () => {
    let conn = anchor.getProvider().connection;
    console.log("-----1-----");

    const { tokenA, tokenB } = await createMintPair(
      owner,
      anchor.getProvider()
    );

    // create serum market
    console.log("-----2-----");
    const marketInfo = await createMarket({
      connection: conn,
      wallet: anchor.Wallet.local(),
      baseMint: tokenA,
      quoteMint: tokenB,
      baseLotSize: 1,
      quoteLotSize: 1,
      dexProgram: globalInfo.marketProgram,
      market: globalInfo.market,
    });
    // wait for transaction success
    sleep(60000);

    // get serum market info
    console.log("-----3-----");
    const market = await getMarket(
      conn,
      marketId,
      globalInfo.marketProgram.toString()
    );
    console.log("market info:", JSON.stringify(market));

    console.log("-----4-----");
    const poolKeys = await getAssociatedPoolKeys({
      programId: globalInfo.ammProgram,
      serumProgramId: globalInfo.marketProgram,
      marketId: market.address,
      baseMint: market.baseMint,
      quoteMint: market.quoteMint,
    });
    console.log("amm poolKeys: ", JSON.stringify(poolKeys));

    const ammAuthority = poolKeys.authority;
    const nonce = poolKeys.nonce;
    const ammId: PublicKey = poolKeys.id;
    const ammCoinVault: PublicKey = poolKeys.baseVault;
    const ammPcVault: PublicKey = poolKeys.quoteVault;
    const lpMintAddress: PublicKey = poolKeys.lpMint;
    const ammTargetOrders: PublicKey = poolKeys.targetOrders;
    const ammOpenOrders: PublicKey = poolKeys.openOrders;

    console.log("-----5-----");
    const [amm_config, _] = await getAmmConfigAddress(globalInfo.ammProgram);
    console.log("amm config:", amm_config.toString());
    //---- initialize test ---;

    console.log("-----6-----");
    const transaction = new Transaction();
    const userCoinTokenAccount = await createAssociatedTokenAccountIfNotExist(
      owner.publicKey,
      market.baseMint,
      transaction,
      anchor.getProvider().connection
    );

    console.log("-----7-----");
    const userPcTokenAccount = await createAssociatedTokenAccountIfNotExist(
      owner.publicKey,
      market.quoteMint,
      transaction,
      anchor.getProvider().connection
    );
    if (transaction.instructions.length > 0) {
      const txid = await sendTx(transaction);
      console.log("create user lp token account txid:", txid);
    }

    console.log("-----8-----");
    const userLPTokenAccount: PublicKey = await getAssociatedTokenAddress(
      poolKeys.lpMint,
      owner.publicKey
    );

    console.log("-----9-----");

    const initAccounts = {
      ammProgram: globalInfo.ammProgram,
      amm: ammId,
      ammAuthority: ammAuthority,
      ammOpenOrders: ammOpenOrders,
      ammLpMint: lpMintAddress,
      ammCoinMint: market.baseMintAddress,
      ammPcMint: market.quoteMintAddress,
      ammCoinVault: ammCoinVault,
      ammPcVault: ammPcVault,
      ammTargetOrders: ammTargetOrders,
      ammConfig: amm_config,
      createFeeDestination: globalInfo.ammCreateFeeDestination,
      market: marketId,
      userWallet: owner.publicKey,
      userTokenCoin: userCoinTokenAccount,
      userTokenPc: userPcTokenAccount,
      userTokenLp: userLPTokenAccount,
    };

    console.log(initAccounts);

    const openTime = getFutureUnixTimestamp(1);

    let tx = await program.methods
      .proxyInitialize(
        nonce,
        new anchor.BN(openTime), //Tue Sep 10 2024 20:24:37 GMT+0000//new anchor.BN(0),
        new anchor.BN(100 * 10 ** 9), // set as you want
        new anchor.BN(200 * 10 ** 9) // set as you want
      )
      .accounts(initAccounts)
      .signers([owner]) //Rockooo
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 2400000 }),
      ])
      .rpc({ preflightCommitment: "confirmed" });
    console.log("initialize tx: ", tx);

    /************************************ deposit test ***********************************************************************/

    console.log("-----10-----");
    tx = await program.methods
      .proxyDeposit(
        new anchor.BN(1000000000), // maxCoinAmount
        new anchor.BN(3000000000), // maxPcAmount
        new anchor.BN(0) // baseSide?
      )
      .accounts({
        ammProgram: globalInfo.ammProgram,
        amm: poolKeys.id,
        ammAuthority: poolKeys.authority,
        ammOpenOrders: poolKeys.openOrders,
        ammTargetOrders: poolKeys.targetOrders,
        ammLpMint: poolKeys.lpMint,
        ammCoinVault: poolKeys.baseVault,
        ammPcVault: poolKeys.quoteVault,
        market: marketId,
        marketEventQueue: market.eventQueue,
        userTokenCoin: userCoinTokenAccount,
        userTokenPc: userPcTokenAccount,
        userTokenLp: userLPTokenAccount,
        userOwner: owner.publicKey,
      })
      .rpc({ preflightCommitment: "confirmed" });
    console.log("deposit tx: ", tx);

    /************************************ withdraw test ***********************************************************************/

    console.log("-----11-----");
    tx = await program.methods
      .proxyWithdraw(
        new anchor.BN(10) // lpAmount
      )
      .accounts({
        ammProgram: globalInfo.ammProgram,
        amm: poolKeys.id,
        ammAuthority: poolKeys.authority,
        ammOpenOrders: poolKeys.openOrders,
        ammTargetOrders: poolKeys.targetOrders,
        ammLpMint: poolKeys.lpMint,
        ammCoinVault: poolKeys.baseVault,
        ammPcVault: poolKeys.quoteVault,
        marketProgram: globalInfo.marketProgram,
        market: marketId,
        marketCoinVault: market.baseVault,
        marketPcVault: market.quoteVault,
        marketVaultSigner: marketInfo.vaultOwner,
        userTokenLp: userLPTokenAccount,
        userTokenCoin: userCoinTokenAccount,
        userTokenPc: userPcTokenAccount,
        userOwner: owner.publicKey,
        marketEventQ: market.eventQueue,
        marketBids: market.bids,
        marketAsks: market.asks,
      })
      .rpc({ preflightCommitment: "confirmed" });

    console.log("withdraw tx: ", tx);

    /************************************ swapBaseIn test ********************************************************************** */

    tx = await program.methods
      .proxySwapBaseIn(
        new anchor.BN(10000), // amountIn
        new anchor.BN(1) // amountOut
      )
      .accounts({
        ammProgram: globalInfo.ammProgram,
        amm: poolKeys.id,
        ammAuthority: poolKeys.authority,
        ammOpenOrders: poolKeys.openOrders,
        ammCoinVault: poolKeys.baseVault,
        ammPcVault: poolKeys.quoteVault,
        marketProgram: globalInfo.marketProgram,
        market: marketId,
        marketBids: market.bids,
        marketAsks: market.asks,
        marketEventQueue: market.eventQueue,
        marketCoinVault: market.baseVault,
        marketPcVault: market.quoteVault,
        marketVaultSigner: marketInfo.vaultOwner,
        userTokenSource: userCoinTokenAccount,
        userTokenDestination: userPcTokenAccount,
        userSourceOwner: owner.publicKey,
      })
      .rpc({ preflightCommitment: "confirmed" });
    console.log("swap_base_in tx: ", tx);

    /************************************ swapBaseOut test ***********************************************************************/

    console.log("-----12-----");
    tx = await program.methods
      .proxySwapBaseOut(
        new anchor.BN(10000), // max_amount_in
        new anchor.BN(1) //amount_out
      )
      .accounts({
        ammProgram: globalInfo.ammProgram,
        amm: poolKeys.id,
        ammAuthority: poolKeys.authority,
        ammOpenOrders: poolKeys.openOrders,
        ammCoinVault: poolKeys.baseVault,
        ammPcVault: poolKeys.quoteVault,
        marketProgram: globalInfo.marketProgram,
        market: marketId,
        marketBids: market.bids,
        marketAsks: market.asks,
        marketEventQueue: market.eventQueue,
        marketCoinVault: market.baseVault,
        marketPcVault: market.quoteVault,
        marketVaultSigner: marketInfo.vaultOwner,
        userTokenSource: userCoinTokenAccount,
        userTokenDestination: userPcTokenAccount,
        userSourceOwner: owner.publicKey,
      })
      .rpc({ preflightCommitment: "confirmed" });
    console.log("swap_base_out tx: ", tx);
  });
});

export async function getAmmConfigAddress(
  programId: PublicKey
): Promise<[PublicKey, number]> {
  const [address, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(anchor.utils.bytes.utf8.encode("amm_config_account_seed"))],
    programId
  );
  return [address, bump];
}
