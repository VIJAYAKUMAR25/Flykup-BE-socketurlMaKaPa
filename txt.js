db.productlistings.insertOne({
    sellerId: ObjectId("67de6bd748065cd30765af55"),
    title: "Banarasi Kota Tissue Silk Saree",
    description: "Banarasi Kota Tissue Silk Saree Description Soft and Grand",
    quantity: 12,
    images: [
      "ProductImage/6229afb6-8df0-41d8-a6c0-edbd9be4623b_shopping (1).jpg"
    ],
    category: "Fashion & Accessories",
    subcategory: "Women's Clothing",
    hsnNo: "15244524",
    productPrice: 6300,
    startingPrice: 5200,
    reservedPrice: 6250,
    weight: "0.5-1 kg",
    hazardousMaterials: "no hazardous materials",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Ex to manually update products