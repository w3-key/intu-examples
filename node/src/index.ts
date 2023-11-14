import {
  createPolybaseKey,
  getUserSignature,
  vaultCreation,
  getAllVaultsDetails,
  preRegistration,
  getRegistrationStatus,
  completeVault,
  getUserPreRegisterInfos,
  automateRegistration,
  registerAllSteps,
  getUserRegistrationAllInfos,
  submitTransaction,
  signTx,
  combineSignedTx,
} from "@intuweb3/node";
import { ethers } from "ethers";
import "dotenv/config";

//insert your Endpoint here
const jsonRpcProvider = new ethers.providers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.JSONRPCID}`);

(async () => {
  const signer1 = ethers.Wallet.createRandom();
  const signer2 = ethers.Wallet.createRandom();
  const signer3 = ethers.Wallet.createRandom();
  //or if you want to try some keys of your own, edit the .env file to put some private keys in there and
  //const signer1 = await createSigner(process.env.SIGNER1);
  //const signer2 = await createSigner(process.env.SIGNER2);
  //const signer3 = await createSigner(process.env.SIGNER3);
  const signerAddress1 = await signer1.getAddress();
  const signerAddress2 = await signer2.getAddress();
  const signerAddress3 = await signer3.getAddress();
  const signerArray = [signer1, signer2, signer3];
  const signerAddressArray = [signerAddress1, signerAddress2, signerAddress3];
  //check for existing vaults
  const vaults = await getAllVaultsDetails(signerAddress1, jsonRpcProvider);
  console.log(vaults);
  let vaultAddress: string = "";
  let mpk: string | undefined = "";
  let id = 0;
  let selectedVault: any;
  //if existing vault(s), connect to latest. Otherwise, create new vault
  if (vaults.length > 0) {
    id = vaults.length - 1;
    vaultAddress = vaults[id].vaultAddress;
    mpk = vaults[id].masterPublicAddress ? vaults[id].masterPublicAddress : "";
    selectedVault = vaults[id];
  } else {
    await vaultCreation(signerAddressArray, "New Intu Vault", 51, 52, 53, signer1);
    return;
  }

  const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
  if (mpk == "") {
    console.log("start registration");
    const repeatReg = async () => {
      //make sure we are done with preRegistration, if not, preregister each user
      let regStatus = await getRegistrationStatus(vaults[id].vaultAddress, signerAddress1, jsonRpcProvider);
      console.log(regStatus);
      if (regStatus.stepToDo === "PREREGISTRATION") {
        preRegistration(vaultAddress, signer1);
        preRegistration(vaultAddress, signer2);
        await preRegistration(vaultAddress, signer3);
      }
      console.log("preregdone");
      await sleep(15000); //ensure everything is done writing to chain
      let ar = await automateRegistration(vaultAddress, signerAddress1, signer1)
        .then(async (result) => {
          for (let i = 0; i < selectedVault.users.length; i++) {
            if (!selectedVault.users[i].isRegistered) {
              await registerAllSteps(selectedVault.vaultAddress, signerArray[i]);
            }
          }
          return true;
        })

        .catch((error) => {
          console.log(error);
        });
      ar; //perform cryptographic functions for everyone, then store the result on chain/in the vault.

      await completeVault(vaultAddress, signer1); //after everyone's data has been stored
      console.log("vaultcomplete");
    };
    repeatReg();
  }

  //if we don't have a transaction yet, for signers to vote on / sign for, create one
  if (mpk && mpk.length > 2 ? true : false) {
    if (vaults[id].transactionCount === 0) {
      let submitTx = async () => {
        console.log("creating transaction");
        // Example for sending an NFT or something
        //let contractInterface = new ethers.utils.Interface(contractJson.abi);
        //let encodedCommand = contractInterface.encodeFunctionData("proposeTransaction", ["0x1234567890"]);
        //console.log(encodedCommand);
        //const data = erc721Interface.encodeFunctionData("safeTransferFrom", [
        //  "0x4f5d7651eceded736a9c49f30193b1fa8a4e668a",
        //  "0x94fD43dE0095165eE054554E1A84ccEfa8fdA47F",
        //  4,
        //]);

        let chainId = "11155111"; // sepolia
        let value = "0.0001";
        let to = "0xF21A6C1BaD49Df0Dd9D52710dd60D35C2D29DA43"; //contract address in case of token transfer
        let gasPrice = "";
        let gas = "";
        let nonce = 0;
        let data = "";
        await submitTransaction(to, value, String(chainId), String(nonce), data, gasPrice, gas, vaultAddress, signer1);
      };
      submitTx();
    }

    //sign tx with 2 signers
    let signTransaction = async () => {
      let txId = 1;
      await signTx(vaultAddress, txId, signer1);
      await signTx(vaultAddress, txId, signer2);
      //await signTx(vaultAddress, txId, signer3);
      //await signTx(vaultAddress, txId, signer4);
    };
    //signTransaction();

    //combine and send tx
    let combineTx = async () => {
      let txId = 1;
      let hash = await combineSignedTx(vaultAddress, txId, signer2);
      let p = new ethers.providers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.JSONRPCID}`);
      console.log(hash.combinedTxHash.finalSignedTransaction);
      p.sendTransaction(hash.combinedTxHash.finalSignedTransaction)
        .then((txResponse) => {
          console.log("Transaction Hash:", txResponse.hash);
        })
        .catch((error) => {
          console.error("Failed to send transaction:", error);
        });
    };
    //combineTx();

    //const doAReshare = async () => {
    //  if (!(await reSharingHasOccurred(vaultAddress, jsonRpcProvider))) {
    //    console.log("start reshare");
    //    let proposedRotationAddress = await signer4.getAddress();
    //    //re-added this function, testing
    //    let myRotationVaults = await getRotationVaultAddresses(proposedRotationAddress, jsonRpcProvider);
    //    console.log(myRotationVaults);
    //    await proposeAddUserInVault(vaultAddress, proposedRotationAddress, signer1);
    //    await sleep(30000);
    //    await preRegistration(vaultAddress, signer4);
    //    console.log("proposeuser");
    //    await sleep(20000);
    //    reShareStep1(vaultAddress, signer1);
    //    reShareStep1(vaultAddress, signer2);
    //    reShareStep1(vaultAddress, signer3);
    //    await reShareStep1(vaultAddress, signer4);
    //    console.log("reg1done");
    //    await sleep(40000);
    //    reShareStep2(vaultAddress, signer1);
    //    reShareStep2(vaultAddress, signer2);
    //    reShareStep2(vaultAddress, signer3);
    //    await reShareStep2(vaultAddress, signer4);
    //    console.log("reg2done");
    //    await sleep(40000);
    //    await reShareStep3(vaultAddress, signer1);
    //    await reShareStep3(vaultAddress, signer2);
    //    await reShareStep3(vaultAddress, signer3);
    //    await sleep(40000);
    //
    //    await reShareStep3(vaultAddress, signer4);
    //    console.log("resharedone");
    //  }
    //};
    //doAReshare();
  }
})();
