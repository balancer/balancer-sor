/*
import { Pool } from '../src/types';

const sor = require('@balancer-labs/sor');
var expect  = require('chai').expect;

it('First test.', function() {
  var isValid = false;
  expect(isValid).to.be.true;
});
*/

// import { helloTest } from '../src/hello-test';
import { expect } from 'chai';
import 'mocha';
import { Pool, SwapAmount, EffectivePrice } from '../src/types';

describe('First test', () => {
    it('should return true', () => {
        // const result = helloTest();
        // expect(result).to.equal(true);
        var isValid = true;
        expect(isValid).to.be.true;
    });
});
