// src\utils\calculateProfit.ts
import { Order } from '../firebase/firestore';

export const calculateMonthlyProfit = (orders: Order[]) => {
  const monthlyData: { [key: string]: { profit: number; timestamp: number } } = {};
  
  orders.forEach(order => {
    if (order.status === 'Delivered') {
      const date = order.createdAt;
      const monthKey = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
      
      // Create a timestamp for the first day of the month for proper sorting
      const year = date.getFullYear();
      const month = date.getMonth();
      const timestamp = new Date(year, month, 1).getTime();
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { profit: 0, timestamp };
      }
      monthlyData[monthKey].profit += order.totalProfit;
    }
  });
  
  return Object.entries(monthlyData)
    .sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp
    .map(([month, data]) => ({ 
      month, 
      profit: Math.round(data.profit),
      timestamp: data.timestamp 
    }));
};

export const getTopProducts = (orders: Order[], limit: number = 5) => {
  const productSales: { [key: string]: { name: string; sales: number; profit: number } } = {};
  
  orders.forEach(order => {
    if (order.status === 'Delivered') {
      order.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { 
            name: item.productName, 
            sales: 0, 
            profit: 0 
          };
        }
        productSales[item.productId].sales += item.quantity;
        productSales[item.productId].profit += (item.finalPrice - item.costPrice) * item.quantity;
      });
    }
  });
  
  return Object.entries(productSales)
    .sort((a, b) => b[1].sales - a[1].sales)
    .slice(0, limit)
    .map(([_, data]) => data);
};

export const getCompleteMonthlyData = (orders: Order[], monthsToShow: number = 6) => {
  const monthlyProfit = calculateMonthlyProfit(orders);
  
  if (monthlyProfit.length === 0) return monthlyProfit;
  
  // Get the most recent month from the data
  const latestTimestamp = Math.max(...monthlyProfit.map(m => m.timestamp));
  const latestDate = new Date(latestTimestamp);
  
  // Generate complete data for the last N months
  const completeData = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let i = monthsToShow - 1; i >= 0; i--) {
    const date = new Date(latestDate.getFullYear(), latestDate.getMonth() - i, 1);
    const monthKey = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
    
    const existingMonth = monthlyProfit.find(m => m.month === monthKey);
    completeData.push({
      month: monthKey,
      profit: existingMonth ? existingMonth.profit : 0,
      timestamp: date.getTime()
    });
  }
  
  return completeData;
};

// Add these functions to your calculateProfit.ts file

export const calculateWeeklyProfit = (orders: Order[]) => {
  const weeklyData: { [key: string]: number } = {};
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayKey = days[date.getDay()];
    weeklyData[dayKey] = 0;
  }
  
  orders.forEach(order => {
    if (order.status === 'Delivered') {
      const orderDate = new Date(order.createdAt);
      const today = new Date();
      const diffTime = today.getTime() - orderDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 6) { // Last 7 days
        const dayKey = days[orderDate.getDay()];
        weeklyData[dayKey] += order.totalProfit;
      }
    }
  });
  
  return Object.entries(weeklyData)
    .map(([period, profit]) => ({ period, profit: Math.round(profit) }));
};

export const calculateYearlyProfit = (orders: Order[]) => {
  const yearlyData: { [key: string]: number } = {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Initialize current year months
  const currentYear = new Date().getFullYear();
  months.forEach(month => {
    yearlyData[`${month} ${currentYear}`] = 0;
  });
  
  orders.forEach(order => {
    if (order.status === 'Delivered') {
      const orderDate = new Date(order.createdAt);
      if (orderDate.getFullYear() === currentYear) {
        const monthKey = orderDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short' 
        });
        yearlyData[monthKey] += order.totalProfit;
      }
    }
  });
  
  return Object.entries(yearlyData)
    .sort((a, b) => {
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const aMonth = a[0].split(' ')[0];
      const bMonth = b[0].split(' ')[0];
      return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
    })
    .map(([period, profit]) => ({ period, profit: Math.round(profit) }));
};

// Add this safe calculation function:
export const calculateSalesmanPerformance = (orders: Order[], salesmanId: string) => {
  // Safe check for empty orders
  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      deliveredOrders: 0,
      totalSales: 0,
      totalProfit: 0,
      averageOrderValue: 0,
      completionRate: 0
    };
  }

  const salesmanOrders = orders.filter(order => order.salesmanId === salesmanId);
  const deliveredOrders = salesmanOrders.filter(order => order.status === 'Delivered');
  
  const totalSales = deliveredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const totalProfit = deliveredOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
  const completionRate = salesmanOrders.length > 0 
    ? (deliveredOrders.length / salesmanOrders.length) * 100 
    : 0;

  return {
    totalOrders: salesmanOrders.length,
    deliveredOrders: deliveredOrders.length,
    totalSales,
    totalProfit,
    averageOrderValue: deliveredOrders.length > 0 ? totalSales / deliveredOrders.length : 0,
    completionRate: Math.round(completionRate)
  };
};

// Add safe monthly sales calculation
export const calculateMonthlySales = (orders: Order[]) => {
  if (!orders || orders.length === 0) {
    return {};
  }

  return orders
    .filter(order => order.status === 'Delivered')
    .reduce((acc: { [key: string]: number }, order) => {
      const month = order.createdAt.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
      acc[month] = (acc[month] || 0) + (order.totalAmount || 0);
      return acc;
    }, {});
};