# E-Commerce Men's Clothing Image Dataset

## Overview

This dataset contains high-quality images of men’s clothing items
scraped from an Indian e-commerce platform and cleaned for machine
learning and computer vision tasks.

It is designed for **clothing classification**, **fashion AI systems**,
and **e-commerce applications**.

---

## Dataset Structure

The dataset is organized in a folder-based class structure:
dataset_clean/
├── casual_shirts/
├── formal_shirts/
├── formal_pants/
├── jeans/
├── men_cargos/
├── printed_hoodies/
├── printed_tshirts/
└── solid_tshirts/
Each folder contains **1000+ cleaned RGB images** belonging to that
category.

---

## Categories (8)

- Casual Shirts
- Formal Shirts
- Formal Pants
- Jeans
- Men Cargos
- Printed Hoodies
- Printed T-Shirts
- Solid T-Shirts

---

## Dataset Details

- Total Categories: 8
- Images per Category: 1000+
- Image Format: JPG / PNG
- Image Type: RGB
- Labeling Method: Folder-based labels

---

## Baseline Model Performance

A baseline experiment was conducted using a **ResNet-50** architecture
pretrained on ImageNet.

- Train / Validation Split: **80% / 20%**
- Validation Accuracy: **~94.8% – 95.0%**
- Training Method: Transfer Learning
- Loss Function: Cross-Entropy Loss
- Optimizer: Adam

This result demonstrates that the dataset is **clean, well-labeled,
and suitable for deep learning models**.

---

## Use Cases

This dataset can be used for:

- Image classification using CNNs (ResNet, EfficientNet, ViT)
- Fashion recommendation systems
- E-commerce product categorization
- Sustainable fashion and resale platforms
- Transfer learning and benchmarking

---

## Data Collection & Cleaning

- Images were scraped for **educational and research purposes**
- Duplicate, corrupted, and low-quality images were removed
- Images were manually reviewed for correct category placement

---

## Disclaimer

This dataset is intended **strictly for educational and research use**.
All images belong to their respective owners.  
No copyright infringement is intended.

If you are the copyright holder and wish to have content removed,
please contact the dataset author.

---

## License

This dataset is released under the **CC BY-NC 4.0**.

---

## Author

Created by **Prashant Sharma**
