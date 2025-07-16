const { calculateOdds } = require('./services/gameLogicService');

// Define all K3 bet types and values
const k3Bets = [
    // SUM bets (specific numbers)
    { betType: 'SUM', betValue: '3' },
    { betType: 'SUM', betValue: '4' },
    { betType: 'SUM', betValue: '5' },
    { betType: 'SUM', betValue: '6' },
    { betType: 'SUM', betValue: '7' },
    { betType: 'SUM', betValue: '8' },
    { betType: 'SUM', betValue: '9' },
    { betType: 'SUM', betValue: '10' },
    { betType: 'SUM', betValue: '11' },
    { betType: 'SUM', betValue: '12' },
    { betType: 'SUM', betValue: '13' },
    { betType: 'SUM', betValue: '14' },
    { betType: 'SUM', betValue: '15' },
    { betType: 'SUM', betValue: '16' },
    { betType: 'SUM', betValue: '17' },
    { betType: 'SUM', betValue: '18' },
    
    // SUM_CATEGORY bets
    { betType: 'SUM_CATEGORY', betValue: 'Small' },
    { betType: 'SUM_CATEGORY', betValue: 'Big' },
    { betType: 'SUM_CATEGORY', betValue: 'Odd' },
    { betType: 'SUM_CATEGORY', betValue: 'Even' },
    
    // PATTERN bets
    { betType: 'PATTERN', betValue: 'straight' },
    { betType: 'PATTERN', betValue: 'all_different' },
    { betType: 'PATTERN', betValue: 'two_different' },
    
    // MATCHING_DICE bets
    { betType: 'MATCHING_DICE', betValue: 'triple_any' },
    { betType: 'MATCHING_DICE', betValue: 'pair_any' },
    { betType: 'MATCHING_DICE', betValue: 'triple_1' },
    { betType: 'MATCHING_DICE', betValue: 'triple_2' },
    { betType: 'MATCHING_DICE', betValue: 'triple_3' },
    { betType: 'MATCHING_DICE', betValue: 'triple_4' },
    { betType: 'MATCHING_DICE', betValue: 'triple_5' },
    { betType: 'MATCHING_DICE', betValue: 'triple_6' },
    { betType: 'MATCHING_DICE', betValue: 'pair_1_2' }, // Example specific pair
    { betType: 'MATCHING_DICE', betValue: 'pair_2_3' }, // Example specific pair
    { betType: 'MATCHING_DICE', betValue: 'pair_3_4' }, // Example specific pair
];

console.log('🎲 K3 Odds Table (as used by bet processing):');
console.log('-------------------------------------------');
console.log('Bet Type         | Bet Value        | Odds');
console.log('-------------------------------------------');
k3Bets.forEach(({ betType, betValue }) => {
    const odds = calculateOdds('k3', betType, betValue);
    console.log(
        (betType + '            ').slice(0, 15) + ' | ' +
        (betValue + '                ').slice(0, 16) + ' | ' +
        odds
    );
});
console.log('-------------------------------------------'); 