const { getRegistrationQueue } = require('./queues/registrationQueue');

async function testRegistrationQueue() {
    try {
        console.log('🧪 Testing registration queue...');
        
        // Test the queue creation - now properly awaiting
        console.log('⏳ Waiting for queue creation...');
        const queue = await getRegistrationQueue();
        console.log('✅ Queue created successfully:', {
            type: typeof queue,
            hasAdd: typeof queue?.add === 'function',
            queueName: queue?.name,
            constructor: queue?.constructor?.name
        });
        
        // Test adding a job
        if (queue && typeof queue.add === 'function') {
            console.log('⏳ Adding test job...');
            const job = await queue.add('test', { message: 'Hello World' });
            console.log('✅ Job added successfully:', job.id);
            
            // Clean up
            await job.remove();
            console.log('✅ Test job cleaned up');
        } else {
            console.log('❌ Queue does not have add method');
        }
        
    } catch (error) {
        console.error('❌ Error testing registration queue:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test and handle any unhandled promise rejections
testRegistrationQueue().catch(error => {
    console.error('❌ Unhandled error in test:', error);
    process.exit(1);
});
