import { createPayInOrder } from '../../services/paymentService.js';

export const payInTransaction = async (req, res) => {
  try {
    const { orderId, payType, amount, notifyUrl } = req.body;

    // Validate required parameters
    if (!orderId || !payType || !amount || !notifyUrl) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const paymentResponse = await createPayInOrder(orderId, payType, amount, notifyUrl);
    res.status(200).json(paymentResponse);
  } catch (error) {
    console.error("PayIn Transaction Error:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
