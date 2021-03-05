window.login = "";
const gameAddress = "0xE291d8C352F164EB7393A6089B6329290E6fbeC1";
const inputs = ["betNumberNumber"];

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const reduceAddressLength = (stringValue) =>
  `${stringValue.substring(0, 5)}...${stringValue.substring(
    stringValue.length - 4
  )}`;

const loadWeb3 = async () => {
  if (window.ethereum) {
    const accounts = await ethereum.enable();
    window.login = accounts[0];
    document.getElementById(
      "account"
    ).textContent = `👤 Connected as ${reduceAddressLength(login)}`;

    window.web3 = new Web3(window.ethereum);

    window.web3WSS = new Web3(
      new Web3.providers.WebsocketProvider("wss://bsc.slime.finance/mainet")
    );
    return true;
  }
  if (window.web3) return true;

  return false;
};

const cache = [];

const addRow = (tr, stringValue) => {
  const td = document.createElement("td");
  td.append(stringValue);
  tr.append(td);
};

const readEvent = (event) => {
  if (cache.includes(event.transactionHash)) return;
  console.log(event);
  cache.push(event.transactionHash);

  const isLoser = event.event == "BetLoser";
  const data = {
    result: isLoser ? "Loser" : "Winner",
    tx: event.transactionHash,
    ...event.returnValues,
  };

  const results = document.getElementById("results");
  const tr = document.createElement("tr");
  if (!isLoser) tr.classList.add("table-primary");
  addRow(tr, reduceAddressLength(data[0]));
  addRow(tr, data.result);
  addRow(tr, data.dice1 + " - " + data.dice2);
  results.prepend(tr);

  if (results.children.length > 10) results.removeChild(results.children[9]);
};

const loadListener = () => {
  const contract = new web3WSS.eth.Contract(window.abi, gameAddress);

  contract.events.allEvents(
    {
      fromBlock: "latest",
      filter: { event: ["BetLoser", "WinLoser"] },
    },
    (err, event) => {
      if (!err) readEvent(event);
    }
  );
};

const adjustBetInputs = ({ minBet, maxBet }) =>
  inputs.forEach((i) => {
    document
      .getElementById(i)
      .setAttribute("placeholder", `Min Bet: ${minBet} - Max Bet: ${maxBet}`);
    document.getElementById(i).setAttribute("min", minBet);
    document.getElementById(i).setAttribute("max", maxBet);
  });

const validateAllowance = async () => {
  const allowance = await window.cToken.methods
    .allowance(window.login, gameAddress)
    .call();
  window.allowance = allowance > 0;

  if (window.allowance) {
    document.getElementById("allowancePanel").classList.add("invisible");
    document.getElementById("betPanel").classList.remove("invisible");
  }
};

const getBalance = async () => {
  const balance = await window.cToken.methods.balanceOf(window.login).call();

  document.getElementById("balance").innerText = formatter.format(
    balance / 1e18
  );
};

const approve = () =>
  window.cToken.methods
    .approve(gameAddress, window.settings.maxBet * 10)
    .send({ from: window.login })
    .then(validateAllowance)
    .catch(console.log);

const betMin = () => {
  document.getElementById("betNumberNumber").value = settings.minBet;
  betNumber();
};

const betMax = () => {
  document.getElementById("betNumberNumber").value = settings.maxBet;
  betNumber();
};

const betNumber = () => {
  const bet = parseInt(document.getElementById("betNumberNumber").value);
  if (bet === 0 || isNaN(bet)) {
    alert("Invalid Bet Amount");
    return;
  }

  const number1 = parseInt(document.getElementById("betNumber1").value);
  if (isNaN(number1) || number1 < 1 || number1 > 6) {
    alert("Invalid Dice Number 1");
    return;
  }

  const number2 = parseInt(document.getElementById("betNumber2").value);
  if (isNaN(number2) || number2 < 1 || number2 > 6) {
    alert("Invalid Dice Number 2");
    return;
  }

  window.contract.methods
    .bet(number1, number2, bet)
    .send({ from: window.login })
    .then((r) => {
      console.log(r);
      document.getElementById("betNumberNumber").value = "";
      document.getElementById("betNumber1").value = "";
      document.getElementById("betNumber2").value = "";
    })
    .catch(console.log);
};

(async function () {
  const isWeb3 = await loadWeb3();

  if (!isWeb3) {
    document.getElementById(
      "account"
    ).textContent = `Unabled to connect to Web3`;

    return;
  }

  window.contract = new web3.eth.Contract(window.abi, gameAddress);

  window.settings = {
    tokenAddress: await window.contract.methods.token().call(),
    minBet: await window.contract.methods.minBet().call(),
    maxBet: await window.contract.methods.maxBet().call(),
  };

  window.cToken = new web3.eth.Contract(
    window.bepAbi,
    window.settings.tokenAddress
  );

  await validateAllowance();
  await getBalance();
  adjustBetInputs(window.settings);
  document.getElementById("mainPanel").classList.remove("invisible");

  setInterval(() => loadListener(), 5000);
})();
