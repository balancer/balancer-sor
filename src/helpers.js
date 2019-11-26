import {Decimal} from "decimal.js"

export const getSpotPrice = (balancer) => {
  let inRatio = balancer.balanceIn.div(balancer.weightIn)
  let outRatio = balancer.balanceOut.div(balancer.weightOut)
  return (inRatio.div(outRatio)).div(Decimal(1).minus(balancer.swapFee))
}

export const getOutputAmountSwap = (balancer, swapType, amount) => {
  let weightIn = balancer.weightIn
  let weightOut = balancer.weightOut
  let balanceIn = balancer.balanceIn
  let balanceOut = balancer.balanceOut
  let swapFee = balancer.swapFee
  if (swapType == 'swapExactIn') {
    let amountIn = Decimal(amount)
    // TODO - break into multiple statements with comments
    return (Decimal(1).minus((balanceIn.div((balanceIn.plus(amountIn.times((Decimal(1).minus(swapFee)))))))).pow(weightIn.div(weightOut))).times(balanceOut)
    // return (1-(Bi/(Bi+Ai*(1-fee)))**(wi/wo))*Bo
  } else {
    let amountOut = Decimal(amount)
    return (((balanceOut.div(balanceOut.minus(amountOut))).pow(weightOut.div(weightIn))).minus(Decimal(1))).times(balanceIn.div(Decimal(1).minus(swapFee)))
  }
}

export const getSlippageLinearizedSpotPriceAfterSwap = (balancer, swapType) => {
  let weightIn = balancer.weightIn
  let weightOut = balancer.weightOut
  let balanceIn = balancer.balanceIn
  let balanceOut = balancer.balanceOut
  let swapFee = balancer.swapFee
  if (swapType === 'swapExactIn') {
    return ((Decimal(1).minus(swapFee)).times(weightIn.div(weightOut)).plus(Decimal(1))).div(balanceIn)
  } else {
    return (weightOut.div(((Decimal(1).minus(swapFee)).times(weightIn))).plus(Decimal(1))).div(balanceOut)
  }
}

export const getSlippageLinearizedEffectivePriceSwap = (balancer, swapType) => {
  let weightIn = balancer.weightIn
  let weightOut = balancer.weightOut
  let balanceIn = balancer.balanceIn
  let balanceOut = balancer.balanceOut
  let swapFee = balancer.swapFee
  if (swapType == 'swapExactIn') {
    return (Decimal(1).minus(swapFee)).times((weightIn.div(weightOut)).plus(Decimal(1))).div((Decimal(2).times(balanceIn)))
  } else {
    return ((weightOut.div(weightIn)).plus(Decimal(1))).div((Decimal(2).times(balanceOut)))
  }
}

export const getLinearizedOutputAmountSwap = (balancer, swapType, amount) => {
  let spotPrice = getSpotPrice(balancer) // TODO
  let slippageLinearizedEp = getSlippageLinearizedEffectivePriceSwap(balancer, swapType)
  
  if (swapType == 'swapExactIn') {
    let amountIn = Decimal(amount)
    return amountIn.div(spotPrice.times(Decimal(1).plus(slippageLinearizedEp.times(amountIn))))
  } else {
    let amountOut = amount
    return amountOut.times(spotPrice.times(Decimal(1).plus(slippageLinearizedEp.times(amountOut))))
  }
}