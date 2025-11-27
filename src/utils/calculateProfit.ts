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

export const getTopProducts = (orders: Order[], limit: number = 10) => {
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

// Add to src/utils/calculateProfit.ts

export const calculateWeeklyItemsSold = (orders: Order[]): { period: string; items: number }[] => {
  // Create keys for the last 7 days
  const days: { key: string; date: Date }[] = [];
  const today = new Date();
  // start from 6 days ago up to today
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = d.toLocaleDateString('en-US', { weekday: 'short' }); // e.g. "Mon"
    // Use day-of-month as well so labels are unique across month boundaries
    const label = `${key} ${d.getDate()}`; // e.g. "Mon 17"
    days.push({ key: label, date: d });
  }

  // initialize map with zeroes
  const itemsByDay: { [key: string]: number } = {};
  days.forEach((d) => (itemsByDay[d.key] = 0));

  // Aggregate orders: count item quantities for orders that fall into the last 7 days
  const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).setHours(0,0,0,0);
  const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).setHours(23,59,59,999);

  orders.forEach((order) => {
    const orderDate = new Date(order.createdAt);
    const t = orderDate.getTime();
    if (t >= startTime && t <= endTime) {
      // find matching day label for this order date
      const label = `${orderDate.toLocaleDateString('en-US', { weekday: 'short' })} ${orderDate.getDate()}`;
      const orderItems = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
      itemsByDay[label] = (itemsByDay[label] || 0) + orderItems;
    }
  });

  // map to ordered array
  return days.map((d) => ({
    period: d.key,
    items: itemsByDay[d.key] || 0,
  }));
};


export const calculateMonthlyItemsSold = (orders: Order[]): { month: string; items: number }[] => {
  const result: { month: string; items: number }[] = [];
  const now = new Date();
  // Build last 12 months list (oldest -> newest)
  const months: { key: string; date: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); // e.g. "Aug 2025"
    months.push({ key, date: d });
  }

  // init map
  const itemsByMonth: { [key: string]: number } = {};
  months.forEach((m) => (itemsByMonth[m.key] = 0));

  // Aggregate delivered orders into months
  orders.forEach((order) => {
    if (!order || !order.createdAt) return;
    const d = new Date(order.createdAt);
    // create same month key format
    const key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    // count items
    const orderItems = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
    if (itemsByMonth.hasOwnProperty(key)) {
      itemsByMonth[key] += orderItems;
    }
    // if order falls outside the 12-month window, ignore it (keeps dataset consistent)
  });

  // build ordered array
  months.forEach((m) => {
    result.push({ month: m.key, items: Math.max(0, Math.round(itemsByMonth[m.key] || 0)) });
  });

  return result;
};

// Yearly: last 5 years (oldest -> newest)
export const calculateYearlyItemsSold = (orders: Order[]): { period: string; items: number }[] => {
  const result: { period: string; items: number }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let i = 4; i >= 0; i--) {
    years.push(currentYear - i);
  }

  const itemsByYear: { [key: string]: number } = {};
  years.forEach((y) => (itemsByYear[String(y)] = 0));

  orders.forEach((order) => {
    if (!order || !order.createdAt) return;
    const d = new Date(order.createdAt);
    const y = d.getFullYear();
    if (itemsByYear.hasOwnProperty(String(y))) {
      const orderItems = (order.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
      itemsByYear[String(y)] += orderItems;
    }
    // orders outside the last 5 years are ignored
  });

  years.forEach((y) => {
    result.push({ period: String(y), items: Math.max(0, Math.round(itemsByYear[String(y)] || 0)) });
  });

  return result;
};