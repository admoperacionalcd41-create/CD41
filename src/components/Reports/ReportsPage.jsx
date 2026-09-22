import React from 'react';
import DailyGoalReport from './DailyGoalReport.jsx';
import DwellTimeReport from './DwellTimeReport.jsx';
import DriverDeliveriesReport from './DriverDeliveriesReport.jsx';
import ProductivityReport from './ProductivityReport.jsx';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <DailyGoalReport />
      <DwellTimeReport />
      <DriverDeliveriesReport />
      <ProductivityReport />
    </div>
  );
}
