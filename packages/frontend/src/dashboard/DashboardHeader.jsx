import React from 'react';

const DashboardHeader = () => (
    <header className="bg-white shadow-sm py-4 px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Real Estate Chatbot Dashboard</h1>
            <div className="flex items-center space-x-4">
                <span className="text-gray-600 text-sm">Welcome, Client Name</span>
                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">
                    CN
                </div>
            </div>
        </div>
    </header>
);

export default DashboardHeader;