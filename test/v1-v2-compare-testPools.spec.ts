import { JsonRpcProvider } from '@ethersproject/providers';
import { loadTestFile } from './lib/testHelpers';
import { compareTest } from './lib/compareHelper';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// This must be updated with pools of interest (see ./test/testData/testPools)
const testFiles = [
    'gusdBug',
    'gusdBugSinglePath',
    '25178485-blockKovan', // UI-506, WETH to WBTC Bug
    // 'stable-and-weighted-token-btp-test',
    // Added pools 'stable-and-weighted-token-btp-test' to element pools
    //  and replaced the base token with DAI. Also
    // added a weighted pool (last in json) with DAI and 0x000...001 to test 2 paths
    'elementFinanceTest_multihop_1path',
    'elementFinanceTest_multihop_2paths',
    'elementFinanceTest_multihop_1path_swapExactOut',
    'elementFinanceTest_multihop_2paths_swapExactOut', // Returning a second swap with -ve amount
    'elementFinanceTestFourPools',
    'elementFinanceTest1',
    'elementFinanceTest2',
    'elementFinanceTest3',
    'elementFinanceTest4',
    // 07/04/21 - Below have been checked and pass
    '0x04ec8acaa4f419bc1525eaa8d37faae2d4acb64c5521a3718593c626962de170', // Dust amounts
    '0xa7a3cf76686c6d6aa6e976724b4463c6f7b0e98453ad3a8488b6e9daa2fecc42', // Dust amounts
    '0xab11cdebd9d96f2f4d9d29f0df62de0640c457882d92435aff2a7c1049a0be6a', // Dust amounts
    '0x0a554ce1e35b9820f121ac7faa97069650df754117d6c5eb7c1158f915878343',
    '0x139894ec2cacfeca1035e78968124dbb2d34034bde146f5f2ab311ada75ad04f',
    '0x21d5562b317f9d3b57b3406ee868ad882ab3c87cd67f7af2ff55042e59702bef',
    '0x32286e13c9dbfe92f4d9527bfe2ff18edf10dedb55e08b11710bf84cebf4de6d',
    '0x39fbeeaacdffc7186135ad169c0bbdbdddb42901a3c12cac2081af603f52ccda',
    '0x4538a9ba66778343983d39a744e6c337ee497247be50090e8feb18761d275306',
    '0x462bd3a36b8a1fdf64e0d9dcf88d18c1d246b4dfca1704f26f883face2612c18',
    '0x5fccb4ca1117b8a274bc6e939c63493203e5744cdf04d0045cf2bc08b01f4c18',
    '0x5fd850f563e180d962bc8e243fbfa27a410e9610faff5f1ecbd2ccdf6599f907',
    '0x6b4011c5e4c17293c0db18fb63e334544107b6451d7e74ce9c88b0b1c07b8fda',
    '0x820b13539ec5117e04380b53c766de9aa604bfb5d751392d3df3d1beff26e30a',
    '0x855d140758a5d0e8839d772ffa8e3afecc522bfbae621cdc91069bfeaaac490c',
    '0x9308920064cab0e15ca98444ec9f91092d24aba03dd383c168f6cc2e45954e0e',
    '0x99cc915640bbb9ef7dd6979062fea2a34eff2b400398a4c00405462840956818',
    '0xfab93b6aece1282a829e8bdcdf2a1aee193a10134279a0a16c989ca71644e85b',
    'fleek-11-03-21',
    'subgraphPoolsDecimalsTest',
    'subgraphPoolsLarge',
    'subgraphPoolsSmallWithTrade',
    '0x03b36dce65627cf8a2a392788c2d319659c8de26b2f83f8d117558891fa59216',
    '0x24ecf45a2fc734c487abcfcdaec558e5d6cc1fb4a7c85ad6b362c017649d3156',
    '0x2ee23274910c172db9de340b1740e63f34b7d86db79827024316f173bf1284d9',
    '0x32c912f8f82952f631c39be6c69bd72a1da978d8d0704a7d32b8310431375bfa',
    '0x3fd20d1d22910c0ee8ae926a1e90afca679cbcc65962135eff43e16fbae12745',
    '0x56164d81bf21d9ec5c2a3f6d93dec8cf39e5ed1567e155bbd66f9d2360b15c95',
    '0x5dd7b4c527806eba0d0ae9e381ea9143ed1e91554e8e060f6d1dcd76119bfdcc',
    '0x88bf77edcbdfc9483904316ac6fdb6e162cf7bfa85a73bc1960ccdab22be351b',
    '0x8e0ea7b408b21005b73238a7e718c8f0320f569ea0c001a1a672bef88288cd91',
    '0x94d106cd9a7e5f2d30ea82a404b1dcfb31c4f6bb85fba228769cf543c5ecf2f5',
    '0x958eb7095ad851133bb2d3282a370108832094082e7554e48c9218cf376cd0be',
    '0xc495fe9e8e74880ddc6d8a42a87bb5b011243e9ba28e23183f68f44439b287b1',
    '0xe331382ecdcad2befe8580a779e28cb4d98bc88da9fac74ae1e95c78417acfde',
    '0xf2826c2b04aef9ddab2c3a7088f33dbc7a0485d57b37b5220f9d86da9eb95b2a',
    '0xf4a5ecfa278f50beb4155bc7bbd3ada5e57d5ceb9825852531981fa66bc94844',
    '0x80422d69eb9272c7b786f602bbce7caad3559a2bd714b5eafb254cfbdd26361c', // Dust amounts
    '0x2db088f092121c107a1bfe97984be190e5ab72fce044c9749c3611ce2365e4da',
    '0x99dd2c21aa009e98e000a3bd515a8ddcbb52748642fde10f9137f9de3cfae957',
    'stable-and-weighted-gas-price-zero',
    'stable-and-weighted-token-btp-test',
    'stable-and-weighted-gas-price-zero',
    'stable-pools-only-wbtc-to-sbtc-exactIn',
    'stable-pools-only-wbtc-to-sbtc-exactOut',
    'stable-and-weighted-same-pools', // This has one stable and one weighted pool with same tokens and balances. Stable should be better. i.e. V2 better than V1.

    // 23/06/21 - After update to Stable pool maths below test is slightly out of range of V1 result
    // '0x995a2d20a846226c7680fff641cee4397f81c6e1f0675d69c7d26d05a60b39f3',
    // 07/06/21 - Following cases fail V1 vs V2 check after a bug fix (previously passing) but confirmed as ok by Fernando
    // '20210521-bal-weth-infinite',
    // The following are cases that fail V1 vs V2 check but have been double checked and confirmed due to maths rounding
    // '0xfc687c72aa619a5c4eb5f5597a2bd69ef1157848243700b57926d36060a6dedc',    // Failing comparing V1 vs V2 - limit difference
    // '0x17497e9e5230493b79c19bad0dc165e06ac0aac3db8eaa4de441d44a70aa9a03',    // Failing - rounding
    // '0x19a742954302f2fee90e823696033c6758b119f17620806971d34e4cda4579af',    // Failing - rounding
    // '0x322749d6fee92b32d01f43d9d9e7cba98a3423194bc4d0e8cc1d724540f20aa2',      // Failing - V1 bug
    // '0x3eb871a70e05bff87dd17b426e80cae10d44b62b198b8c3e3576c31f09de116c',    // Failing - rounding
    // '0x3f319e935f56ff76be555f6c7b6e9f410bd425a97c867b848fc8162bb6bd54f1',    // Failing - rounding
    // '0x460539952504c660268f525812e0eef7f6d80c5cd24a1d3743df23059f51d243',    // Failing - rounding
    //'0x4c01eda6ce118df14db981777a0afa36276291d2170632ac01dbb8728d02acf2',       // Failing - rounding
    // '0x5523ac56f308a7a2b3d26197cc8498a29d2d7ed8bfda52dbed83698166971a27',    // Failing - rounding
    // '0x5d8ac083d65d9b16c701964a3a3b34585b883180473a187e9f9ed25531a5d0e3',       // Failing - rounding
    // '0x8c5e8f7df8206b50f669e44c6ed9f2f88944ab27d46c898218a02fbed21ad1d6',  // Failing - rounding
    // '0x6abfd063a04f0badbb10d021c3a9fbdb2836f5c953af8c18cd89e940cccd4199',    // Failing - rounding
    //'0xef63986beadea3f78acf5afc7665f8087f798627d4a094df134a4f643dda8057', // Failing - rounding
    // '0x18a934486971129d335b5a166e5d9dc2c271c8b7ff6c7ea079e2b97d45273403', // approx.
    // '0x2f455a0e72ad4a2f6be9a5969a2e646ec8c1c2f4cc19adfffa53ba5ba468f02e', // approx
    // '0x726355cd7b33332ea32101ecc1fe0b0c214328d6fb6d277b0bbc14360e7ddd71', // Approx
    // '0x81ddc85bdd36b0e8d21f340615d37e151017b516be2f6f20213654c45d75d6a9', // Approx
    // '0x8ff899ff6a8729bb4b2600f6a491d1262001a4a591f11eac532bb20c30cb0074', // Approx
    // '0xabfeac41f0b0798e67e24557004eea1b1f18f973ea40689425267794ce88f35c', // Approx
    // '0xb8d4677d37d143abf30f3a4ad720a0a9487cad83e053cccb32a5fad1c775ae64', // Approx
    // '0xce3f018d5e66430057d70135ac7c027bd60992e25b3d9de961f18f4ae980d467', // Approx
    // '0xd8087d6392b331f1664c18d40e62cf89fdff63722404d7563011e44cbb1e6c4c', // Approx
    // '0xe956c08ac8cb1b7e6e7b248488c2aa690651d98d2bc1a7d54cd914ecef7c0c27', // Approx
    // '0xf4b9d3efbe306a94a8487d15fc80f9e701b42bfedcbd6246574d5278690c4a37', // Approx
    // '0xf521d8b5c199c57a5544f478af253e619eb0d05b4cb09e8298f3a704d8f119f0', // Too BIG an error, V1 seems to have the bug
    // '0xf6e67f7aa877caa7add6d4c85ef2737bc342a578ab8ecb4b62ddaba15fe1c6ca', // Too BIG an error, V1 seems to have the bug
    // '0xfdd81d285a2d103a8d6dac5c68d9bcc48cc107590656c0ab44cd8877c75a9430', // Approx
    // '0x319c2887b117c9a555cb1f3c8b82f135cb9a576222934a3c23eedb4fb8f2d8bb',
    // '0x243f47a5c531b263b94ec2514aedd62ee45c43ec761c9d68bc27cfa3db0469dc',
    // '0x138b142350336ae74acf0de423849206089e7100177e6d1dcbc8c6f0aedc76a4',
    // '0x0a96d61ff013aff7dde200d3aaa6b7e1bc3a30d1701b9a0d60bb63d931cdbdcc',
    // '0x6910af6d48b1eb1a33c3de6f53f809aad315179f12d49b757f74c687b16d71aa',
    // '0x63a9c56abf0e49661923eda4aeb8dd3af1ad1c6dae981d6f1c6465d9e44d306c',
    // '0x5ab001723607608fcc0a2bc085aac73145b7b55163359a0910fc71d5e327aaf1',
    // '0x4b0b1c2598cac7a08d716683ac35f88f234df76508b14982cdd7a88b170c20a5',
    // '0x465ef97f569b568bb486a600a5d7c11389f9a925fce5d5f07d6caf5893c7b6e2',
    // '0x4049450e9cc2b947409cec9b8fb795e5e8defc6ae5dabae0856b90928082680a',
    // '0xab88111bd9e2e8c59fd59b84f2d2545b40d42491ad16b720c1344e1c93388523',
    // '0xaf03fbdfd91af3130114164107078f46cdd606c51dc1b8e1fe044648990b4b6e',
    // '0xa04bc9066116b13e832a9e57667ed6485e087e84fa1fc500987e7ecdc5b98fe0',
    // '0x8cfbf4b745e94ee26f1649a7a8bc05636b607085e63519a5280fee2380815e55',
    // '0x8d2d92e19a8ee728eeaf68a1ece8694fa5fbe11806ab14a81c814729e4afcf7d',
    // '0x86ee8f4eaf4819a362e1a3cd856df827de1fe95140bdcadc6915fa0964296b95',
    // '0x6b5a3751269a952a6a8e1765d755e97e403f2e03078405d38c17691a3d136af6',
    // '0xec1351e006668709c87ab4a3c402c8fd1a9136619293b1322e15183746f22293',
    // '0xddfa94487c65b7b432fd750212a32d9e2f273a60e6b42983974b2bc0927998eb',
    // '0xd3b9ce97141378c4c87726a3a139df3f24d44cd9187487ed1c1912b834f54f3b',
    // '0xd68826bf7ec8c83d250efac7d38567146a66bcaba9c415825736dcb6fbce2b46',
    // '0xd7236b8a38f11b4a67b7c2eca89b0bf69187a50e3deb9bfe9f215064ae63dcba',
    // '0xc942c544631edcd1d73a17354c1997ad20482736117c0fd86e9ffd25eae18623',
    // '0xb69fdcc676e206124c50fa607924e4fb49a40761dd4a21cb4acf20f88fcd7970',
    // '0xbf58764ea30623769a3520a141f5beb2de61f571c5d82aa0048290c417ddba61',
    // '0xbf7f8dc5c7cc9fe1cc7654395610fe2625d06a67d80b079c238647631a048da8',
    // '0xc0ff267f73ee9accb8a0b434966f95ac83dff238396e7d0f937644b8c853c588',
    // '0xb0fc4e5d34ceaa323482df5bc0954799799cd88fe90d780aa0c1e759005e84b8',
    // '0xf946ea7c1e43120a30ccfd240632d0abd4175e55a8c7ecfa6de1bd0663c9c9d2',
    // '0xf5bf68fb418a0c2ed7e31f1972cdf5ccbad1375093aa0707c1e382d162be8d18',
    // '0x221c2f98afb75ae7ba165e70c647fc76c777b434eb84375d7261a0c951a0510c', // > 1 path
    // '0x269e99c9cedfba33d877019c3f6ebebbfbb04c3a2874292765972cdd9ee47b05', // > 1 path
    // '0x4190309f9453fc3784f13731171f1d4cf0f873dbc6d594dc9a6bb3819727bf6c',
    // '0x6458ba03bd9707104c86c9ead2fcf6fcfdcb0b83d6fac5c683a0b687be4aa7fd',
    // '0xac60bc1f5ff0fb9a1c981991c9b355c38c65e53f79e3d8d15ee66830910c4ba1',
    // '0xbdce4f52f4a863e9d137e44475cc913eb82154e9998819ce55846530dbd3025d',
    // '0x873ce8165a03b39bd25cb0b6e44397fa8a811247488e4ed7a6cdf0bcbf709410',
    // '0x087d606d31d5c60e7b5ae9dbec31e7fc4f0bf71a81abfc5b0bf03390e925034f',
    // '0x08ec2862ec5c1ede9087dfe0015d72603767b2ed243a17fbd431d5df37a50826',
    // '0x1c140552d2362e4f361bad928f66f273ae188841934abd36c46a45cf981f7559',
    // '0x1d003bffebf27ab36c69502da4d2aadbac99a1d794ad188bea0966ea15bf038c',
    // '0x25b8c910acd316601f5d8b4840b672e7d9c6a6c2ad9d6237ab50c0b090b97c92',
    // '0x3571f6490274bfdfea808e0b13c9ddae3f344fc361b6f46166b524665e287aac',
    // '0x362e00b25d6105d89d164b10a685178c87b52137152adc941d96a90f0ff9157e',
    // '0x38b0898f94ce7cb0621adc763d1cfc73cd91545842c2a587b6a7828be498dc5d',
    // '0x3b2d665943c0ac011d97a3fe29ed5ea388acb38aa43289774c75adaf61c078a9',
    // '0x4141bc25373f3cd1893e3b29455996f5f459a698b90cb1745d2962bfb7dae891',
    // '0x4313a949375dd43297dd73bb754f33a1a9d9680a3650fcc867e202fa5914ef2c',
    // '0x4794ccc4f633a3caec767a811b569234798bc49b9b454de6e85a9c5e544a86e4',
    // '0x4cc50daad4c6e2db5dd9ed3668019db96e88b7ad4ca58027e7486835a0e977eb',
    // '0x4cdd6c43d7eea494b7006b2c1dd76c7154fe72c18c35fc4fb0ae525e99082247',
    // '0x5692950aa787b0502fac586425f7c0ab503c43e667236300a032f18a8de6d796',
    // '0x6296adbe389d693b6c1800010bb23fb3db044e63f2c3e6097c58b6f5d34bbc96',
    // '0x676403139165aad1c8e251350b30306d823562a63699cf51c55a6f28eb8c1aed',
    // '0x6df803d2dd8373a443e7fb58e8d867e38b074bb25c7d47e709b310a90d4ba648',
    // '0x72492628b146d079a8a7801aafccc1a0de2d0c888efc00609cf82316fac86f2a',
    // '0x7e68f4beedf0a844a83e989121a8179785a3c45ea731cd086cde8391992c1d5b',
    // '0x8401ce3cdc364d96f6f2722521215d05d2e52033b225456fb32e82620d51a925',
    // '0x8be6f8c9c2e92d3d20504e7c6c26fe2fddb5c1ec32dc72ec8d9d8c18e223819b',
    // '0x8dded375a2a8bc1bb60049ef482931657fc0fffc79233394edf5dc830426a91e',
    // '0x93db5e0965435057224eee49563ac616fbc9fe531aab95ccd754e4a91fc658e0',
    // '0x95e9d514d6c751ce4781be643906ea0b9100f80b82dc52e72d5c76b84b8afc64',
    // '0x9f0559dbf2512e4cb5754f74b917941fd0098d2ac9963cd7113b167e8b91ae54',
    // '0xa92d76d916fe5fdbb5283a36daaad226089fc3c94e0f7fe41a2173eafe524390',
    // '0xb48d49d52b1925f06c9a3b59c026fa8c9d1951ce583592ecc749c35cd6d83172',
    // '0xc2ce998972eafe5bf0f6fb85935587f725546482e757c917fc650d3b55d3f694',
    // '0xc5b6dd6551d62ed8636e40e96b07d335a64c5513f2f143ed2133bb7e8009a68b',
    // '0xcacbae3bcfa3d5b8001022c0c9066abb66db43abb074dc6552430fde05aa9bb5',
    // '0xdbd9638d8df794dba5a330d29481e23e067d1387933cc95a558c8f93ea7b98ba',
    // '0xe5028956be2588276c2a68c8317714d73bdb74aa5857e6d8b7d1d83d1668c529',
    // '0xea8838d8d150852b7d2e30a620ca7f03f183b9905a6781b13bec86be02f505a2',
    // '0xec9c0dc4f427a7f1753ced4daccd74a8d59a3c51865abb306a8e92a0b7db345a',
    // '0xedf81b3087eec79b94af1730de6a4532749541fc5fbf5b3a3cd553d910dbbbc8',
    // '0xf1432b7fd3a114eac740e0e8f9c271805acd2f673cf8b9df9958bf7d393b3ae4',
    // '0xf36183ce11febc716e85efcfb40040ad7c4a370e2bbe1b645bd5b9e893b3fc0e',
    // '0xf75d7ed8a5dc324f0220cd91119afc8b354ba17686f0812ba79f6dee4dc1173c',
];

const testDir = `${__dirname}/testData/testPools/`;

// npx mocha -r ts-node/register test/v1-v2-compare-testPools.spec.ts
// This compare V1 vs V2 swaps and V2 vs V2 with filter swaps pools saved in ./test/testData/testPools folder.
// Does not use OnChain balances as the pools were originally saved after a failure and snapshot should have balances, etc that caused issues.
// Compare V1 vs V2 and V2 vs V2 with filter.
// !!! Note - testFiles array must be manually updated to contain pools of interest.
async function loopTests(file) {
    it(`Compare Testing: ${file}`, async () => {
        const testData = loadTestFile(`${testDir}/${file}.json`);

        if (!testData.tradeInfo) return;

        await compareTest(file, provider, testData);
        // assert(false);
    }).timeout(10000);
}

testFiles.forEach((file) => {
    loopTests(file);
});
