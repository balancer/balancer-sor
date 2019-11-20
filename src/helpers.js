export const getSpotPrice = (balancer) => {
  let inRatio = balancer.Bi / balancer.wi
  let outRatio = balancer.Bo / balancer.wo
  return (( inRatio / outRatio ) / ( 1 - balancer.fee ))
}

export const getOutputAmountSwap = (balancer, swapType, amount) => {
  let wi = balancer.wi
  let wo = balancer.wo
  let Bi = balancer.Bi
  let Bo = balancer.Bo
  let fee = balancer.fee
  if (swapType == 'swapExactIn') {
    let Ai = amount
    return (1-(Bi/(Bi+Ai*(1-fee)))**(wi/wo))*Bo
  } else {
    let Ao = amount
    return ((Bo/(Bo-Ao))**(wo/wi)-1)*Bi/(1-fee)
  }
}

export const getSlippageLinearizedSpotPriceAfterSwap = (balancer, swapType) => {
  let wI = balancer.wi
  let wO = balancer.wo
  let bI = balancer.Bi
  let bO = balancer.Bo
  let sF = balancer.fee
  if (swapType === 'swapExactIn') {
    return ((1 - sF) * (wI / wO) + 1) / bI
  } else {
    return (wO / ((1 - sF) * wI) + 1) / bO
  }
}

export const getSlippageLinearizedEffectivePriceSwap = (balancer, swapType) => {
  let wi = balancer.wi
  let wo = balancer.wo
  let Bi = balancer.Bi
  let Bo = balancer.Bo
  let fee = balancer.fee
  if (swapType == 'swapExactIn') {
    return (1-fee)*(wi/wo+1)/(2*Bi)
  } else {
    return (wo/wi+1)/(2*Bo)
  }
}

export const getLinearizedOutputAmountSwap = (balancer, swapType, amount) => {
  let spotPrice = getSpotPrice(balancer) // TODO
  let slippageLinearizedEp = getSlippageLinearizedEffectivePriceSwap(balancer, swapType)
  
  if (swapType == 'swapExactIn') {
    let Ai = amount
    return Ai / (spotPrice*(1+slippageLinearizedEp*Ai))
  } else {
    let Ao = amount
    return Ao * (spotPrice*(1+slippageLinearizedEp*Ao))
  }
}