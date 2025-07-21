# Admin Deposit Approval System Guide

## Overview

The admin deposit approval system allows administrators to manually approve or reject pending deposits/recharges. This is particularly useful for:

- Manual verification of deposits
- Handling deposits that require additional verification
- Managing deposits from payment gateways that don't support automatic callbacks
- Providing better control over the deposit process

## System Architecture

### 1. Database Tables

#### `wallet_recharges` Table
```sql
CREATE TABLE wallet_recharges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  order_id VARCHAR(255),
  transaction_id VARCHAR(255),
  payment_gateway_id INT NOT NULL,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  bonus_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `users` Table (Relevant Fields)
```sql
-- Fields used in deposit approval
wallet_balance DECIMAL(10,2) DEFAULT 0.00,
actual_deposit_amount DECIMAL(10,2) DEFAULT 0.00,
has_received_first_bonus BOOLEAN DEFAULT FALSE
```

#### `transactions` Table
```sql
-- Records all deposit-related transactions
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'deposit', 'deposit_rejected'
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  description TEXT,
  reference_id VARCHAR(255),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. API Endpoints

#### Get Pending Deposits
```http
GET /api/admin/recharges/pending?page=1&limit=10
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "recharges": [
    {
      "user_id": 123,
      "mobile_number": "9876543210",
      "order_id": "PI123456789",
      "recharge_type": "Gateway 1",
      "applied_amount": "1000.00",
      "balance_after": "1500.00",
      "apply_date_time": "2024-01-15T10:30:00Z",
      "recharge_id": 456,
      "user_registered_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

#### Approve/Reject Deposit
```http
POST /api/admin/recharges/process
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "recharge_id": 456,
  "action": "approve",
  "notes": "Payment verified via bank statement"
}
```

**For Rejection:**
```json
{
  "recharge_id": 456,
  "action": "reject",
  "notes": "Payment not received in bank account"
}
```

**Response (Approval):**
```json
{
  "success": true,
  "message": "Deposit approved and wallet credited",
  "data": {
    "rechargeId": 456,
    "depositAmount": 1000.00,
    "bonusAmount": 150.00,
    "totalAmount": 1150.00,
    "newBalance": 2150.00
  }
}
```

**Response (Rejection):**
```json
{
  "success": true,
  "message": "Deposit rejected",
  "data": {
    "rechargeId": 456,
    "rejectionReason": "Payment not received in bank account"
  }
}
```

## Deposit Approval Process

### 1. Approval Flow

When an admin approves a deposit:

1. **Validation**: Check if recharge exists and is in 'pending' status
2. **User Verification**: Ensure user exists
3. **Bonus Calculation**: Calculate first deposit bonus if applicable
4. **Status Update**: Update recharge status to 'completed'
5. **Wallet Credit**: Add deposit amount + bonus to user's wallet
6. **User Stats Update**: Update actual_deposit_amount and first bonus flag
7. **Transaction Record**: Create transaction record for audit trail
8. **Commit**: Commit all changes in a single transaction

### 2. Rejection Flow

When an admin rejects a deposit:

1. **Validation**: Check if recharge exists and is in 'pending' status
2. **Status Update**: Update recharge status to 'failed'
3. **Transaction Record**: Create failed transaction record
4. **Commit**: Commit changes

### 3. First Deposit Bonus System

The system automatically calculates and applies first deposit bonuses:

#### Bonus Tiers
| Deposit Amount | Bonus Amount |
|----------------|--------------|
| ₹100+          | ₹20          |
| ₹300+          | ₹60          |
| ₹1,000+        | ₹150         |
| ₹3,000+        | ₹300         |
| ₹10,000+       | ₹600         |
| ₹30,000+       | ₹2,000       |
| ₹1,00,000+     | ₹7,000       |
| ₹2,00,000+     | ₹15,000      |

#### Eligibility Criteria
- User's `actual_deposit_amount` must be 0
- User's `has_received_first_bonus` must be false
- Only applies to the first deposit

## Implementation Details

### 1. Service Layer (`paymentService.js`)

```javascript
const processRechargeAdminAction = async (adminId, rechargeId, action, notes = '') => {
  const t = await sequelize.transaction();
  
  try {
    // Get recharge with validation
    const recharge = await WalletRecharge.findByPk(rechargeId, { transaction: t });
    
    // Process based on action
    if (action === 'approve') {
      // Calculate bonus
      const bonusAmount = calculateFirstDepositBonus(user, recharge.amount);
      
      // Update recharge status
      await recharge.update({
        status: 'completed',
        bonus_amount: bonusAmount
      }, { transaction: t });
      
      // Update user wallet
      const totalAmount = parseFloat(recharge.amount) + bonusAmount;
      await user.update({
        wallet_balance: parseFloat(user.wallet_balance) + totalAmount,
        actual_deposit_amount: parseFloat(user.actual_deposit_amount) + parseFloat(recharge.amount)
      }, { transaction: t });
      
      // Create transaction record
      await Transaction.create({
        user_id: recharge.user_id,
        type: 'deposit',
        amount: totalAmount,
        status: 'completed',
        description: `Deposit approved by admin - ${notes}`
      }, { transaction: t });
    }
    
    await t.commit();
    return { success: true, message: "Deposit processed successfully" };
    
  } catch (error) {
    await t.rollback();
    throw error;
  }
};
```

### 2. Controller Layer (`rechargeController.js`)

```javascript
const processRechargeActionController = async (req, res) => {
  try {
    const { recharge_id, action, notes } = req.body;
    const adminId = req.user.user_id;
    
    // Validation
    if (!recharge_id || !action) {
      return res.status(400).json({
        success: false,
        message: 'Recharge ID and action are required'
      });
    }
    
    if (action === 'reject' && !notes) {
      return res.status(400).json({
        success: false,
        message: 'Notes are required when rejecting a recharge'
      });
    }
    
    // Process the action
    const result = await processRechargeAdminAction(
      adminId,
      recharge_id,
      action,
      notes || ''
    );
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error processing recharge action:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing recharge action'
    });
  }
};
```

### 3. Route Layer (`adminRoutes.js`)

```javascript
// Recharge management routes
router.get('/recharges/pending', getAllPendingRechargesController);
router.post('/recharges/process', processRechargeActionController);
router.get('/recharges/successful', getAllSuccessfulRechargesController);
```

## Security Features

### 1. Authentication & Authorization
- All endpoints require valid admin JWT token
- IP whitelist protection for admin routes
- Role-based access control

### 2. Transaction Safety
- All operations wrapped in database transactions
- Automatic rollback on errors
- Atomic operations to prevent partial updates

### 3. Validation
- Input validation for all parameters
- Status validation to prevent double processing
- User existence verification

### 4. Audit Trail
- All actions logged in transaction table
- Admin ID tracked for accountability
- Detailed notes for approval/rejection reasons

## Usage Examples

### 1. Frontend Integration

```javascript
// Get pending deposits
const getPendingDeposits = async (page = 1) => {
  const response = await fetch(`/api/admin/recharges/pending?page=${page}`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// Approve a deposit
const approveDeposit = async (rechargeId, notes) => {
  const response = await fetch('/api/admin/recharges/process', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recharge_id: rechargeId,
      action: 'approve',
      notes: notes
    })
  });
  return response.json();
};

// Reject a deposit
const rejectDeposit = async (rechargeId, reason) => {
  const response = await fetch('/api/admin/recharges/process', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recharge_id: rechargeId,
      action: 'reject',
      notes: reason
    })
  });
  return response.json();
};
```

### 2. Admin Dashboard Features

#### Pending Deposits List
- Display all pending deposits with user details
- Show deposit amount, payment gateway, and timestamp
- Provide approve/reject buttons for each deposit

#### Deposit Details Modal
- Show complete user information
- Display payment gateway details
- Show transaction history
- Provide notes field for approval/rejection

#### Bulk Operations
- Select multiple deposits for bulk approval
- Bulk rejection with common reason
- Export pending deposits to CSV

## Monitoring & Analytics

### 1. Key Metrics
- Number of pending deposits
- Average approval time
- Approval/rejection ratio
- Total amount in pending deposits

### 2. Audit Logs
- All admin actions logged
- User notification system
- Email alerts for large deposits

### 3. Performance Monitoring
- Response time tracking
- Error rate monitoring
- Database performance metrics

## Best Practices

### 1. Admin Guidelines
- Always verify payment before approval
- Use descriptive notes for rejections
- Review user history before approval
- Set up alerts for large deposits

### 2. System Configuration
- Set appropriate timeouts
- Configure backup procedures
- Monitor system resources
- Regular security audits

### 3. User Communication
- Notify users of approval/rejection
- Provide clear rejection reasons
- Send confirmation emails
- Update user dashboard in real-time

## Troubleshooting

### 1. Common Issues

#### Deposit Not Found
- Check if recharge ID is correct
- Verify deposit status is 'pending'
- Check database connectivity

#### User Not Found
- Verify user exists in database
- Check user status (blocked/unblocked)
- Validate user ID format

#### Transaction Errors
- Check database connection
- Verify transaction isolation level
- Monitor for deadlocks

### 2. Error Handling
- Graceful error messages
- Detailed logging for debugging
- Automatic retry mechanisms
- Fallback procedures

## Conclusion

The admin deposit approval system provides a robust, secure, and user-friendly way to manage deposits manually. It includes comprehensive validation, audit trails, and bonus calculation features while maintaining data integrity and security.

The system is designed to be scalable, maintainable, and easily integrated with existing admin dashboards and user interfaces. 