const TronWeb = require('tronweb');
const rl = require('readline-sync');
const fs = require('node:fs');
const dotenv = require('dotenv');
dotenv.config();

const HttpProvider = TronWeb.providers.HttpProvider;
const fullNode = new HttpProvider("https://api.trongrid.io");
const solidityNode = new HttpProvider("https://api.trongrid.io");
const eventServer = new HttpProvider("https://api.trongrid.io");

const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const checkBonding = async (sunPumpRouterContract, address) => {
    let result = await sunPumpRouterContract.isSunPumpToken(address).call();
    
    return result;
}

const getBalance = async (tokenContract, address) => {
    const balance = await tokenContract.balanceOf(address).call();
    
    return balance;
}


const getMinTokenTokenToBuy = async (sunPadLaunchpadContract, tokenAddress, trxAmount) => {
    const getMinTokenTokenToBuy = await sunPadLaunchpadContract.getTokenAmountByPurchaseWithFee(tokenAddress, trxAmount).call();
    const minAmountToBuy = getMinTokenTokenToBuy[0].toString();

    return minAmountToBuy;
}

const getTRXAmountBySale = async (sunPadLaunchpadContract, tokenAddress,balanceToken) => {
    const getminTrxAmountBySale = await sunPadLaunchpadContract.getTrxAmountBySaleWithFee(tokenAddress, balanceToken).call();
    const minTrxAmountBySale = getminTrxAmountBySale[0].toString();

    return minTrxAmountBySale;
}

const getAmountsOutSundotIO = async (sunPumpRouterContract, amountInSun, path) => {

    const amountsOut = await sunPumpRouterContract.methods.getAmountsOut(amountInSun, path).call();
    return amountsOut;
}

const buyTokenInSunPump = async (sunPadLaunchpadContract, tokenAddress, trxAmount) => {
    const minAmountToBuy = await getMinTokenTokenToBuy(sunPadLaunchpadContract, tokenAddress, trxAmount);

    const tx = await sunPadLaunchpadContract.purchaseToken(tokenAddress,minAmountToBuy).send({
        callValue: trxAmount,
        feeLimit: 100000000,
    });

    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`);
}

const SellTOkenSunPump = async (sunPadLaunchpadContract, tokenAddress, balanceToken) => {
    const minTrxAmountBySale = await getTRXAmountBySale(sunPadLaunchpadContract, tokenAddress, balanceToken);

    const tx = await sunPadLaunchpadContract.saleToken(tokenAddress, balanceToken, minTrxAmountBySale).send({
        feeLimit: 100000000,
    });
    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`);
}

const buyTokeninSundotIO = async (sunPumpRouterContract, trxamount, path,to_address) => {
    const amountsOut = await getAmountsOutSundotIO(sunPumpRouterContract, trxamount, path);
    
    const tx = await sunPumpRouterContract.swapExactETHForTokens(
        amountsOut.amounts[1],
        path,
        to_address,
        Math.floor(Date.now() / 1000) + 60 * 10
    ).send({
        callValue: trxamount,
        feeLimit: 100000000,
    })

    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`)
}

const sellTokeninSundotIO = async (sunPumpRouterContract, tokenAmount, path, to_address) => {
    const amountsOut = await getAmountsOutSundotIO(sunPumpRouterContract, tokenAmount, path);
    
    const tx = await sunPumpRouterContract.swapExactTokensForETH(
        tokenAmount,
        amountsOut.amounts[1],
        path,
        to_address,
        Math.floor(Date.now() / 1000) + 60 * 10
    ).send({
        feeLimit: 100000000,
    })

    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`)
}

const aproveToken = async (tokenContract, contracAddress,address) => {
    const check = await tokenContract.allowance(address, contracAddress).call();
    if(Number(check) > 0){
        return;
    }else{
        const maxUint256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const approveFunction = tokenContract.approve(
            contracAddress,
            maxUint256,
        );
    
      const transaction = await approveFunction.send({
        feeLimit: 100000000,
      });
      console.log("Approve success: ", `https://tronscan.org/#/transaction/${transaction}`);
    }
}

(async()=>{
    while(true){
        try {
            const privateKey = process.env.PRIVATE_KEY;
            const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, privateKey);
            const address = tronWeb.address.fromPrivateKey(privateKey);
            const balanceInSun = await tronWeb.trx.getBalance(address);
    
            const implementationABI  = JSON.parse(fs.readFileSync('abiSunpad.json', 'utf8'));
            const tokenContractABI  = JSON.parse(fs.readFileSync('abitoken.json', 'utf8'));
            const routerSunPumpRouterAbi = JSON.parse(fs.readFileSync('abiSunPumpRouter.json', 'utf8'));
            const sunPumpRouterCa = 'TZFs5ch1R1C4mmjwrrmZqeqbUgGpxY1yWB'
            const sunPadLaunchpadCa = 'TTfvyrAz86hbZk5iDpKD78pqLGgi8C7AAw'
            
            let routerSunPumpContract = await tronWeb.contract(routerSunPumpRouterAbi, sunPumpRouterCa);
            let sunPadLaunchpadContract = await tronWeb.contract(implementationABI, sunPadLaunchpadCa);
            
            console.log(`Address: ${address}\nBalance: ${Number(balanceInSun)/10**6} TRX\n`);
            console.log('1. Swap TRX to Token\n2. Sale Token to TRX');
            const choice = rl.question('Choice: ');
    
            if(choice == 1){
                const tokenAddress = rl.question('Token Address: ');
                const trxAmount = Number(rl.question('TRX Amount: '));

                const isBonding = await checkBonding(routerSunPumpContract, tokenAddress);
                if(!isBonding){
                    const tokenContract = await tronWeb.contract(tokenContractABI, tokenAddress);
                    const confirmation = rl.question('Are you sure you want to buy this token? (Y/N): ');
                    if (confirmation.toLowerCase() === 'y') {
                        await buyTokenInSunPump(sunPadLaunchpadContract, tokenAddress, tronWeb.toSun(trxAmount));
                        await aproveToken(tokenContract, sunPadLaunchpadCa, address);
                    } else {
                        console.log('Buy operation cancelled.');
                    }
                }else{
                    const addressesBase58 = [
                        "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR", //WTRX
                        tokenAddress // Token to buy
                    ];
                    
                    const path = addressesBase58.map(address => {
                        const hexAddress = tronWeb.address.toHex(address);
                        return '0x' + hexAddress.slice(2); 
                    });

                    const confirmation = rl.question('Are you sure you want to buy this token? (Y/N): ');
                    if (confirmation.toLowerCase() === 'y') {
                        await buyTokeninSundotIO(routerSunPumpContract, tronWeb.toSun(trxAmount), path, address);
                        const tokenContract = await tronWeb.contract(tokenContractABI, tokenAddress);
                        await aproveToken(tokenContract, sunPumpRouterCa, address);
                    } else {
                        console.log('Buy operation cancelled.');
                    }
                }
            }else if(choice == 2){
                const tokenAddress = rl.question('Token Address: ');
                const isBonding = await checkBonding(routerSunPumpContract, tokenAddress);
                
                if(!isBonding){
                    const tokenContract = await tronWeb.contract(tokenContractABI, tokenAddress);
                    const balanceToken = await getBalance(tokenContract, address);
                    console.log(`Balance Token: ${Number(balanceToken)/10**16}`);
                    
                    const confirmation = rl.question('Are you sure you want to sell all your tokens? (Y/N): ');
                    if (confirmation.toLowerCase() === 'y') {
                        await SellTOkenSunPump(sunPadLaunchpadContract, tokenAddress, balanceToken);
                    } else {
                        console.log('Sell operation cancelled.');
                    }
                }else{
                    const addressesBase58 = [
                        tokenAddress, // Token to Sell
                        "TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR", //WTRX
                    ];
                    
                    const path = addressesBase58.map(address => {
                        const hexAddress = tronWeb.address.toHex(address);
                        return '0x' + hexAddress.slice(2); 
                    });

                    const tokenContract = await tronWeb.contract(tokenContractABI, tokenAddress);
                    const balanceToken = await getBalance(tokenContract, address);
                    console.log(`Balance Token: ${Number(balanceToken)/10**16}`);

                    const confirmation = rl.question('Are you sure you want to sell all your tokens? (Y/N): ');
                    if (confirmation.toLowerCase() === 'y') {
                        await sellTokeninSundotIO(routerSunPumpContract, balanceToken, path, address);
                    } else {
                        console.log('Sell operation cancelled.');
                    }
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
    
})()