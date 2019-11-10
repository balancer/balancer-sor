import {getSpotPrice, getSlippageLinearizedSpotPriceAfterSwap, getLinearizedOutputAmountSwap, getOutputAmountSwap} from './helpers'
let bdata = require("./data.json");
let swapType = 'swapExactOut'
let inputAmount = 1000
let maxBalancers = 20
let gasPrice = 0.00000001 // 1 Gwei
let gasPerTrade = 210000 // eg. 210k gas
let outTokenEthPrice = 100

let costPerTrade = gasPrice * gasPerTrade // eg. 210k gas @ 10 Gwei
let costOutputToken = costPerTrade * outTokenEthPrice

const linearizedSolution = (balancers, swapType, inputAmount, maxBalancers, costOutputToken) => {

  balancers.forEach(b=> {
    b.spotPrice = getSpotPrice(b)
    b.slippage = getSlippageLinearizedSpotPriceAfterSwap(b, swapType)
  })
  let sortedBalancers = balancers.sort((a, b) => {
    return a.spotPrice - b.spotPrice
  })

  let epsOfInterest = getEpsOfInterest(sortedBalancers).sort((a, b)=> { return a.ep - b.ep})

  epsOfInterest = calculateBestBalancersForEpsOfInterest(epsOfInterest)

  epsOfInterest.forEach(e=> {
    let bids = e.bestBalancers
    let ep = e.ep
    e.inputAmounts = getInputAmountsForEp(sortedBalancers, bids, ep)
  })

  let bestTotalOutput = 0
  let balancerIds, totalOutput
  let bestInputAmounts, bestBalancerIds, inputAmounts
  let solution = {}
  for (let b = 1; b < maxBalancers; b++) {
    totalOutput = 0

    let e, epAfter, epBefore, inputAmountsEpBefore, inputAmountsEpAfter    
    for (let i = 0; i < epsOfInterest.length; i++) {
      e = epsOfInterest[i]
      epAfter = e
      
      if (i == 0) {
        epBefore = epAfter
      }

      let inputAmountsAfter = epAfter.inputAmounts
      let totalAmount = inputAmountsAfter.slice(0, b).reduce((a, b)=> a + b)

      if (totalAmount > inputAmount) {
        balancerIds = epBefore.bestBalancers.slice(0, b)
        inputAmountsEpBefore = epBefore.inputAmounts.slice(0, b)
        inputAmountsEpAfter = epAfter.inputAmounts.slice(0, b)

        inputAmounts = getExactInputAmounts(inputAmountsEpBefore, inputAmountsEpAfter, inputAmount)
        
        totalOutput = getLinearizedTotalOutput(balancers, swapType, balancerIds, inputAmounts)
        
        if (swapType == 'swapExactIn') {
          totalOutput -= balancerIds.length * costOutputToken
        } else {
          totalOutput += balancerIds.length * costOutputToken
        }
        break;
      }

      epBefore = epAfter
    }

    let improvementCondition = false
    if (swapType == 'swapExactIn') {
      improvementCondition = (totalOutput > bestTotalOutput) || (bestTotalOutput == 0)
    } else {
      improvementCondition = (totalOutput < bestTotalOutput) || (bestTotalOutput == 0)
    }

    if (improvementCondition == true) {
      bestInputAmounts = inputAmounts
      bestBalancerIds = balancerIds
      bestTotalOutput = totalOutput
    } else {
      solution.inputAmounts = bestInputAmounts
      solution.selectedBalancers = bestBalancerIds
      solution.totalOutput = bestTotalOutput
      return solution
    }
  }

  solution.inputAmounts = inputAmounts
  solution.selectedBalancers = balancerIds
  solution.totalOutput = totalOutput
  
  return solution
}

const getEpsOfInterest = (sortedBalancers) => {

  let epsOfInterest = []
  sortedBalancers.forEach((b, i)=> {
    let epi = {}
    epi.ep = b.spotPrice
    epi.bid = b.id
    epsOfInterest.push(epi)

    for (let k = 0; k < i; k++) {
      let prevBal = sortedBalancers[k]

      if (b.slippage < prevBal.slippage) {
        epi = {}
        epi.ep = prevBal.spotPrice + (b.spotPrice - prevBal.spotPrice) * (prevBal.slippage / (prevBal.slippage - b.slippage))
        epi.swap = [prevBal.id, b.id]
        epsOfInterest.push(epi)
      }
    }
  })

  return epsOfInterest
}

const calculateBestBalancersForEpsOfInterest = (epsOfInterest) => {
  let bestBalancers = []
  epsOfInterest.forEach((e, i) => {
    if(e.bid != null) {
      bestBalancers.push(e.bid)
    } else if (e.swap) {
      let index1 = bestBalancers.indexOf(e.swap[0])
      let index2 = bestBalancers.indexOf(e.swap[1])

      if (index1 != -1) {
        if (index2 != -1) {
          let bestBal1 = bestBalancers[index1]
          let bestBal2 = bestBalancers[index2]
          bestBalancers[index1] = bestBal2
          bestBalancers[index2] = bestBal1
        } else {
          bestBalancers[index1] = e.swap[2]
        }
      }
    } else {
      console.log(e)
      console.error('ERROR: balancerID or swap not found in epsOfInterest')
    }
    epsOfInterest[i].bestBalancers = bestBalancers.slice()
  })
  return epsOfInterest
}

const getInputAmountsForEp = (balancers, bids, ep) => {
  let inputAmounts = []
  bids.forEach((bid, i)=> {
    let balancer = balancers.find(obj => {return obj.id === bid})
    inputAmounts.push((ep - balancer.spotPrice) / balancer.slippage)
  })
  return inputAmounts
}

const getLinearizedTotalOutput = (balancers, swapType, balancerIds, inputAmounts) => {
  let balancer
  let totalOutput = 0
  balancerIds.forEach((b, i)=> {
    balancer = balancers.find(obj => {return obj.id === b})
    totalOutput += getLinearizedOutputAmountSwap(balancer, swapType, inputAmounts[i])
  })
  return totalOutput
}

const getExactInputAmounts = (inputAmountsEpBefore, inputAmountsEpAfter, targetTotalInput) => {
  let deltaInputAmounts = []
  inputAmountsEpAfter.forEach((a, i)=> {
    let diff = a - inputAmountsEpBefore[i]
    deltaInputAmounts.push(diff)
  })
  let totalInputBefore = inputAmountsEpBefore.reduce((a, b)=> a + b)
  let totalInputAfter = inputAmountsEpAfter.reduce((a, b)=> a + b)
  let deltaTotalInput = totalInputAfter - totalInputBefore

  let deltaTimesTarget = []
  deltaInputAmounts.forEach((a, i)=> {
    let mult = a * ((targetTotalInput-totalInputBefore) / deltaTotalInput)
    deltaTimesTarget.push(mult)
  })

  let inputAmounts = []
  inputAmountsEpBefore.forEach((a, i)=> {
    let add = a + deltaTimesTarget[i]
    inputAmounts.push(add)
  })
  return inputAmounts
}

const verifyAndPrintSolution = (solution, balancers) => {
  let inputAmounts = solution.inputAmounts
  let selectedBalancers = solution.selectedBalancers
  let totalOutput = solution.totalOutput

  let actualTotalOutput = 0

  selectedBalancers.forEach((b, i)=> {
    let balancer = balancers.find(obj => {return obj.id === b})
    actualTotalOutput += getOutputAmountSwap(balancer, swapType, inputAmounts[i])
    console.log(actualTotalOutput)
    if (swapType == 'swapExactIn') {
      actualTotalOutput -= costOutputToken
    } else {
      actualTotalOutput += costOutputToken
    }
  })

    console.log('Best solution found for ' + swapType + ' (input amount =' + inputAmount +') with '+ inputAmounts.length  + ' Balancers')
    console.log(selectedBalancers)
    console.log('Input amounts: ')
    console.log(inputAmounts)
    console.log('Estimated total_output: ')
    console.log(totalOutput)
    console.log('Actual total_output: ')
    console.log(actualTotalOutput)
}

let solution = linearizedSolution(bdata, swapType, inputAmount, maxBalancers, costOutputToken)

verifyAndPrintSolution(solution, bdata)
