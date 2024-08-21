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

const buyTokenInSunPump = async (sunPadLaunchpadContract, tokenAddress, trxAmount) => {
    const minAmountToBuy = await getMinTokenTokenToBuy(sunPadLaunchpadContract, tokenAddress, trxAmount);

    const tx = await sunPadLaunchpadContract.purchaseToken(tokenAddress,minAmountToBuy).send({
        callValue: trxAmount,
    });

    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`);
}

const saleToken = async (sunPadLaunchpadContract, tokenAddress, balanceToken) => {
    const minTrxAmountBySale = await getTRXAmountBySale(sunPadLaunchpadContract, tokenAddress, balanceToken);

    const tx = await sunPadLaunchpadContract.saleToken(tokenAddress, balanceToken, minTrxAmountBySale).send();
    console.log('Transaction:', `https://tronscan.org/#/transaction/${tx}`);
}

(async()=>{
    try {
        const privateKey = process.env.PRIVATE_KEY;
        const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, privateKey);
        const address = tronWeb.address.fromPrivateKey(privateKey);
        const balanceInSun = await tronWeb.trx.getBalance(address);

        const implementationABI  = JSON.parse(fs.readFileSync('abiSunpad.json', 'utf8'));
        const tokenContractABI  = JSON.parse(fs.readFileSync('abitoken.json', 'utf8'));
        const sunPumpRouterCa = 'TZFs5ch1R1C4mmjwrrmZqeqbUgGpxY1yWB'
        const sunPadLaunchpadCa = 'TTfvyrAz86hbZk5iDpKD78pqLGgi8C7AAw'
        
        let routerSunPumpContract = await tronWeb.contract().at(sunPumpRouterCa);
        let sunPadLaunchpadContract = await tronWeb.contract(implementationABI, sunPadLaunchpadCa);
        
        console.log(`Address: ${address}\nBalance: ${Number(balanceInSun)/1000000} TRX`);
        console.log('1. Swap TRX to Token\n2. Sale Token to TRX');
        const choice = rl.question('Choice: ');

        if(choice == 1){
            const tokenAddress = rl.question('Token Address: ');
            const trxAmount = Number(rl.question('TRX Amount: '));
            await buyTokenInSunPump(sunPadLaunchpadContract, tokenAddress, (trxAmount*1000000));
        }else if(choice == 2){
            const tokenAddress = rl.question('Token Address: ');
            const tokenContract = await tronWeb.contract(tokenContractABI, tokenAddress);
            const balanceToken = await getBalance(tokenContract, address);
            console.log(`Balance Token: ${Number(balanceToken)/10**16}`);
            
            await saleToken(sunPadLaunchpadContract, tokenAddress, balanceToken);
        }
        // const tokenAddress = 'TQgo7fp75XifXsyjPCxR1RALKQUaKweJy6';
        // let tokenContract = await tronWeb.contract(tokenContractABI, tokenAddress);
        // const trxAmount = 100000000;

        // const isBonding = await checkBonding(routerSunPumpContract,'TQgo7fp75XifXsyjPCxR1RALKQUaKweJy6');
        





        // if(!isBonding){

        // }else{

        // }
    } catch (error) {
        console.error(error);
    }
    
})()