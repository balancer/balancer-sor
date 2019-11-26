import {getSpotPrice, getSlippageLinearizedSpotPriceAfterSwap, getLinearizedOutputAmountSwap, getOutputAmountSwap} from './helpers'
import {Decimal} from "decimal.js"

Decimal.set({ precision: 18, rounding: Decimal.ROUND_HALF_CEIL }) 

let swapType = 'swapExactIn'
let maxBalancers = 20
let gasPrice = Decimal(0.00000001) // 1 Gwei
let gasPerTrade = Decimal(210000) // eg. 210k gas
let outTokenEthPrice = Decimal(100)

let costPerTrade = gasPrice.times(gasPerTrade) // eg. 210k gas @ 10 Gwei
let costOutputToken = costPerTrade.times(outTokenEthPrice)

export const linearizedSolution = (balancers, swapType, targetInputAmount, maxBalancers, costOutputToken) => {

  targetInputAmount = Decimal(targetInputAmount)
  console.log(targetInputAmount)
  balancers.forEach(b=> {
    b.balanceIn = Decimal(b.balanceIn)
    b.balanceOut = Decimal(b.balanceOut)
    b.weightIn = Decimal(b.weightIn)
    b.weightOut = Decimal(b.weightOut)
    b.swapFee = Decimal(b.swapFee)
    b.spotPrice = getSpotPrice(b)
    b.slippage = getSlippageLinearizedSpotPriceAfterSwap(b, swapType)
  })
  let sortedBalancers = balancers.sort((a, b) => {
    return a.spotPrice.minus(b.spotPrice)
  })

  let epsOfInterest = getEpsOfInterest(sortedBalancers).sort((a, b)=> { return a.ep.minus(b.ep)})

  epsOfInterest = calculateBestBalancersForEpsOfInterest(epsOfInterest)

  epsOfInterest.forEach(e=> {
    let bids = e.bestBalancers
    let ep = e.ep
    e.inputAmounts = getInputAmountsForEp(sortedBalancers, bids, ep)
  })

  let bestTotalOutput = 0
  let highestEpNotEnough = true
  let balancerIds, totalOutput
  let bestInputAmounts, bestBalancerIds, inputAmounts
  let solution = {}

  let bmin = Math.min(maxBalancers, (balancers.length + 1))
  for (let b = 1; b <= bmin; b++) {
    totalOutput = 0

    let e, epAfter, epBefore, inputAmountsEpBefore, inputAmountsEpAfter    
    for (let i = 0; i < epsOfInterest.length; i++) {
      e = epsOfInterest[i]
      
      epAfter = e
      
      if (i == 0) {
        epBefore = epAfter
        continue;
      }

      
      let inputAmountsAfter = epAfter.inputAmounts
      let totalInputAmountAfter = inputAmountsAfter.slice(0, b).reduce((a, b)=> a.plus(b))

      if (totalInputAmountAfter.greaterThan(targetInputAmount)) {
        balancerIds = epBefore.bestBalancers.slice(0, b)
        inputAmountsEpBefore = epBefore.inputAmounts.slice(0, b)
        inputAmountsEpAfter = epAfter.inputAmounts.slice(0, b)

        inputAmounts = getExactInputAmounts(inputAmountsEpBefore, inputAmountsEpAfter, targetInputAmount)

        highestEpNotEnough = false
        break;
      }

      epBefore = epAfter
    }

    if (highestEpNotEnough) {
      balancerIds = epBefore.bestBalancers.slice(0, b)
      inputAmounts = getExactInputAmountsHighestEpNotEnough(balancers, b, epBefore, targetInputAmount)
    }


    totalOutput = getLinearizedTotalOutput(balancers, swapType, balancerIds, inputAmounts)
        

    let improvementCondition = false
    if (swapType == 'swapExactIn') {
      totalOutput = totalOutput.minus(Decimal(balancerIds.length).times(costOutputToken))
      improvementCondition = (totalOutput.greaterThan(bestTotalOutput)) || (bestTotalOutput == 0)
    } else {
      totalOutput = totalOutput.plus(Decimal(balancerIds.length).times(costOutputToken))
      improvementCondition = (totalOutput.lessThan(bestTotalOutput)) || (bestTotalOutput == 0)
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

      if (b.slippage.lessThan(prevBal.slippage)) {
        epi = {}
        epi.ep = prevBal.spotPrice.plus((b.spotPrice.minus(prevBal.spotPrice)).times(prevBal.slippage.div(prevBal.slippage.minus(b.slippage))))
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
    inputAmounts.push((ep.minus(balancer.spotPrice)).div(balancer.slippage))
  })
  return inputAmounts
}

const getLinearizedTotalOutput = (balancers, swapType, balancerIds, inputAmounts) => {
  let balancer
  let totalOutput = Decimal(0)
  balancerIds.forEach((b, i)=> {
    balancer = balancers.find(obj => {return obj.id === b})
    totalOutput = totalOutput.plus(getLinearizedOutputAmountSwap(balancer, swapType, inputAmounts[i]))
  })
  return totalOutput
}

const getExactInputAmounts = (inputAmountsEpBefore, inputAmountsEpAfter, targetTotalInput) => {
  let deltaInputAmounts = []
  inputAmountsEpAfter.forEach((a, i)=> {
    let diff = a.minus(inputAmountsEpBefore[i])
    deltaInputAmounts.push(diff)
  })
  let totalInputBefore = inputAmountsEpBefore.reduce((a, b)=> a.plus(b))
  let totalInputAfter = inputAmountsEpAfter.reduce((a, b)=> a.plus(b))
  let deltaTotalInput = totalInputAfter.minus(totalInputBefore)

  let deltaTimesTarget = []
  deltaInputAmounts.forEach((a, i)=> {
    let mult = a.times((targetTotalInput.minus(totalInputBefore)).div(deltaTotalInput))
    deltaTimesTarget.push(mult)
  })

  let inputAmounts = []
  inputAmountsEpBefore.forEach((a, i)=> {
    console.log(a)
    console.log(deltaTimesTarget[i])
    let add = a.plus(deltaTimesTarget[i])
    console.log(add)
    console.log('')
    inputAmounts.push(add)
  })
  return inputAmounts
}

const getExactInputAmountsHighestEpNotEnough = (balancers, b, epBefore, targetInputAmount) => {
  let balancerIds = epBefore.bestBalancers.slice(0, b)
  let inputAmountsEpBefore = epBefore.inputAmounts.slice(0, b)
  let totalInputBefore = inputAmountsEpBefore.reduce((a, b)=> a.plus(b))
  let deltaTotalInput = targetInputAmount.minus(totalInputBefore)
  let inverseSls = []
  balancerIds.forEach((b, i)=> {
    let balancer = balancers.find(obj => {return obj.id === b})
    inverseSls.push(Decimal(1).div(balancer.slippage))
  })

  let sumInverseSls = inverseSls.reduce((a, b)=> a.plus(b))
  let deltaEP = deltaTotalInput.div(sumInverseSls)

  let deltaTimesTarget = []
  inverseSls.forEach((a, i)=> {
    let mult = a.times(deltaEP)
    deltaTimesTarget.push(mult)
  })

  let inputAmounts = []
  inputAmountsEpBefore.forEach((a, i)=> {
    let add = a.plus(deltaTimesTarget[i])
    inputAmounts.push(add)
  })
  return inputAmounts
}

const verifyAndPrintSolution = (solution, balancers) => {
  
  let inputAmounts = solution.inputAmounts
  let selectedBalancers = solution.selectedBalancers
  let totalOutput = solution.totalOutput

  let actualTotalOutput = Decimal(0)

  selectedBalancers.forEach((b, i)=> {
    let balancer = balancers.find(obj => {return obj.id === b})
    actualTotalOutput = actualTotalOutput.plus(getOutputAmountSwap(balancer, swapType, inputAmounts[i]))
    if (swapType == 'swapExactIn') {
      actualTotalOutput = actualTotalOutput.minus(costOutputToken)
    } else {
      actualTotalOutput = actualTotalOutput.plus(costOutputToken)
    }
  })

    console.log('Best solution found for ' + swapType + ' (input amount =' + inputAmount +') with '+ inputAmounts.length  + ' Balancers')
    console.log(selectedBalancers)
    console.log('Input amounts: ')
    console.log(inputAmounts.toString())
    console.log('Estimated total_output: ')
    console.log(totalOutput)
    console.log('Actual total_output: ')
    console.log(actualTotalOutput)
}

// let inputAmount = 1
// let bdata = require('../data.json')
// let solution = linearizedSolution(bdata, swapType, inputAmount, maxBalancers, costOutputToken)
// verifyAndPrintSolution(solution, bdata)


