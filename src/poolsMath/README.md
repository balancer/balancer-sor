## Pools formulas using bigint type

Swap outcome and "spot price after swap" formulas for weighted, stable and linear pools.
Amounts are represented using bigint type. Swap outcomes formulas should
match exactly those from smart contracts.

Test cases are found in poolsMathWeighted.spec.ts, poolsMathStable.spec.ts poolsMathLinear.spec.ts.

It is necessary to review whether to use MathSol operations or native +,-,\*,/ case by case. MathSol operations are able to reproduce overflows while native operations produce a much more readable code. For instance, for "spot price after swap" native operations
are preferred since in this case there are not smart contract analogs, amount limits are assumed to have been checked elsewhere, and some formulas get complicated, specially for stable pools.
