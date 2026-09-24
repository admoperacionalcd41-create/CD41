import React from 'react';
import DailyProcessReport from './DailyProcessReport.jsx';
import DailyGoalReport from './DailyGoalReport.jsx';
import DwellTimeReport from './DwellTimeReport.jsx';
import DriverDeliveriesReport from './DriverDeliveriesReport.jsx';
import ProductivityReport from './ProductivityReport.jsx';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <DailyProcessReport />
      <DailyGoalReport />
      <DwellTimeReport />
      <DriverDeliveriesReport />
      <ProductivityReport />
    </div>
  );
}
