retry: {
  match: [
    /SequelizeDeadlockError/,
    /Deadlock found when trying to get lock/,
    'ER_LOCK_DEADLOCK'
  ],
  max: 3,
  backoffBase: 1000,
  backoffExponent: 1.5
}, 