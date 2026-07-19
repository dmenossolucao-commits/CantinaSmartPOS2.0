/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import { 
  Package, Search, Plus, Filter, Trash2, Edit2, AlertTriangle, 
  CheckCircle, ArrowUpDown, X, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductManagerProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onZeroStock?: () => void;
  useStockControl?: boolean;
}

export default function ProductManager({ 
  products, 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct,
  onZeroStock,
  useStockControl = true
}: ProductManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');

  // Form Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCategory, setFormCategory] = useState<Product['category']>('Salgados');
  const [formStock, setFormStock] = useState('20');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formImageUrl, setFormImageUrl] = useState('');

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('A imagem deve ter menos de 2MB para garantir a performance de salvamento.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Low stock products alert calculation
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= p.minStock);
  }, [products]);

  // Filter & Sort menu
  const processedProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCat;
    });

    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'stock') return a.stock - b.stock;
      if (sortBy === 'price') return a.price - b.price;
      return 0;
    });

    return result;
  }, [products, searchTerm, selectedCategory, sortBy]);

  // Form Submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    const priceNum = parseFloat(formPrice.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Insira um preço de venda válido.');
      return;
    }

    if (editingProduct) {
      // Edit
      const updated: Product = {
        ...editingProduct,
        name: formName,
        price: priceNum,
        category: formCategory,
        stock: Number(formStock),
        minStock: Number(formMinStock),
      };
      if (formImageUrl) {
        updated.imageUrl = formImageUrl;
      } else {
        delete updated.imageUrl;
      }
      onUpdateProduct(updated);
    } else {
      // Add
      const newP: Product = {
        id: 'p_' + Math.random().toString(36).substring(2, 9),
        name: formName,
        price: priceNum,
        category: formCategory,
        stock: Number(formStock),
        minStock: Number(formMinStock),
      };
      if (formImageUrl) {
        newP.imageUrl = formImageUrl;
      }
      onAddProduct(newP);
    }

    setShowModal(false);
    resetForm();
    // Reset search and filters so the newly created/updated product is instantly visible
    setSearchTerm('');
    setSelectedCategory('Todos');
  };

  const handleZeroStockClick = () => {
    const password = prompt('Digite a senha administrativa para ZERAR o estoque de todos os produtos:');
    if (password === null) return; // User cancelled
    if (password === 'admin123') {
      if (confirm('ATENÇÃO: Deseja realmente ZERAR o estoque de TODOS os produtos do cardápio? Esta ação não pode ser desfeita.')) {
        if (onZeroStock) {
          onZeroStock();
        }
      }
    } else {
      alert('Senha incorreta! Operação cancelada.');
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormCategory(product.category);
    setFormStock(product.stock.toString());
    setFormMinStock(product.minStock.toString());
    setFormImageUrl(product.imageUrl || '');
    setShowModal(true);
  };

  const handleCreateClick = () => {
    setEditingProduct(null);
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormPrice('');
    setFormCategory('Salgados');
    setFormStock('20');
    setFormMinStock('5');
    setFormImageUrl('');
  };

  const handleDeleteClick = (productId: string) => {
    setShowDeleteConfirm(productId);
  };

  return (
    <div id="product-manager-root" className="space-y-6 select-none">
      
      {/* Product list - Full width */}
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden">
        
        {/* Toolbar Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="font-sans font-bold text-gray-800 text-base flex items-center gap-2">
              <Package size={18} className="text-emerald-600" />
              Cardápio e Estoque da Cantina
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="zero-stock-btn"
                onClick={handleZeroStockClick}
                className="py-1.5 px-3 bg-red-50 hover:bg-red-150 border border-red-200 text-red-600 rounded-xl text-xs font-sans font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                title="Zerar o estoque de todos os produtos mediante senha"
              >
                <Trash2 size={13} /> Zerar Estoque
              </button>
              <button
                id="new-product-btn"
                onClick={handleCreateClick}
                className="py-1.5 px-3 bg-emerald-600 text-white rounded-xl text-xs font-sans font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm shadow-emerald-100"
              >
                <Plus size={14} /> Novo Item
              </button>
            </div>
          </div>

          {!useStockControl && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-xs font-sans flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600 animate-pulse shrink-0" />
              <span>O controle de estoque está <strong>desativado</strong> nas configurações do PDV. Os itens podem ser vendidos sem restrição de quantidade no caixa.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={14} />
              </span>
              <input
                id="search-inventory-input"
                type="text"
                placeholder="Buscar produto por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Sort Toggle */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1">
              <span className="text-[10px] text-gray-400 font-sans shrink-0 uppercase font-bold">Ordenar:</span>
              <select
                id="inventory-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-[11px] font-sans font-medium text-gray-700 bg-transparent border-none focus:outline-none w-full"
              >
                <option value="name">Alfabética</option>
                <option value="stock">Menor Estoque</option>
                <option value="price">Menor Preço</option>
              </select>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {['Todos', 'Salgados', 'Bebidas', 'Doces', 'Almoço', 'Outros'].map(cat => (
              <button
                key={cat}
                id={`inventory-category-${cat}`}
                onClick={() => setSelectedCategory(cat)}
                className={`py-1.5 px-3 rounded-lg font-sans text-[11px] font-medium transition-all shrink-0 ${
                  selectedCategory === cat 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Catalog Table list */}
        <div>
          {processedProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={36} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-sans">Nenhum item correspondente no estoque.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {processedProducts.map(product => {
                const imgUrl = product.imageUrl || 
                  ({
                    'p1': 'https://images.unsplash.com/photo-1626200419199-391ae4be7e41?auto=format&fit=crop&w=600&q=80',
                    'p2': 'https://images.unsplash.com/photo-1585544314018-e0d37e124b83?auto=format&fit=crop&w=600&q=80',
                    'p3': 'https://images.unsplash.com/photo-1590137876181-2a5a7e340308?auto=format&fit=crop&w=600&q=80',
                    'p4': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
                    'p5': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
                    'p6': 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=600&q=80',
                    'p7': 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80',
                    'p8': 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80',
                    'p9': 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80',
                    'p10': 'https://images.unsplash.com/photo-1530610476181-d83430964d5b?auto=format&fit=crop&w=600&q=80',
                    'p11': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=600&q=80',
                    'p12': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
                    'p13': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=600&q=80',
                    'p14': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
                    'p15': 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
                    'p16': 'https://images.unsplash.com/photo-1582138110529-f8a75a3e144a?auto=format&fit=crop&w=600&q=80',
                    'p17': 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=600&q=80',
                    'p18': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
                    'p19': 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&w=600&q=80',
                    'p20': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80',
                  } as Record<string, string>)[product.id] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

                return (
                  <div
                    key={product.id}
                    id={`inventory-row-${product.id}`}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100/50">
                        <img src={imgUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] text-gray-400 font-sans block mb-0.5">
                          {product.category}
                        </span>
                        <h4 className="font-sans font-bold text-xs text-gray-800 leading-tight">
                          {product.name}
                        </h4>
                        <span className="text-xs font-mono font-bold text-emerald-700 block mt-0.5">
                          R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    {/* Stock Status display */}
                    <div className="text-left sm:text-right shrink-0">
                      <div className="flex items-center gap-1 justify-start sm:justify-end">
                        <span className={`w-2 h-2 rounded-full ${
                          product.stock <= 0 
                            ? 'bg-red-500' 
                            : product.stock <= product.minStock 
                              ? 'bg-amber-500 animate-pulse' 
                              : 'bg-emerald-500'
                        }`} />
                        <span className="font-mono font-bold text-xs text-gray-800">
                          {product.stock} un em estoque
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono block">
                        Mínimo crítico: {product.minStock} un
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        id={`edit-product-btn-${product.id}`}
                        onClick={() => handleEditClick(product)}
                        className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
                        title="Editar produto"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        id={`delete-product-btn-${product.id}`}
                        onClick={() => handleDeleteClick(product.id)}
                        className="p-1.5 bg-gray-50 hover:bg-red-50 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-100 transition-colors"
                        title="Remover produto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD / EDIT PRODUCT */}
      <AnimatePresence>
        {showModal && (
          <div id="product-form-modal" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border"
            >
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-sans font-bold text-gray-900 text-sm">
                  {editingProduct ? 'Editar Informações do Produto' : 'Cadastrar Novo Item no Cardápio'}
                </h3>
                <button 
                  id="close-product-modal-btn"
                  onClick={() => setShowModal(false)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form id="product-data-form" onSubmit={handleFormSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] text-gray-500 font-sans block mb-1">Nome do Produto *</label>
                  <input
                    id="form-product-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Coxinha de Frango c/ Catupiry"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-sans block mb-1">Preço de Venda (R$) *</label>
                    <input
                      id="form-product-price"
                      type="text"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="6,50"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-sans block mb-1">Categoria *</label>
                    <select
                      id="form-product-category"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Salgados">Salgados</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Doces">Doces</option>
                      <option value="Almoço">Almoço</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 font-sans block mb-1">Estoque Inicial *</label>
                    <input
                      id="form-product-stock"
                      type="number"
                      required
                      min="0"
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-sans block mb-1">Estoque Mínimo *</label>
                    <input
                      id="form-product-min-stock"
                      type="number"
                      required
                      min="0"
                      value={formMinStock}
                      onChange={(e) => setFormMinStock(e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-sans block mb-1">Imagem do Produto (URL ou arquivo JPG/PNG)</label>
                  <div className="space-y-2">
                    <input
                      id="form-product-image-url"
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-sans focus:outline-none focus:border-emerald-500 placeholder-gray-350"
                    />
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs py-1 px-2.5 rounded-lg font-sans font-medium border border-gray-300 transition-colors inline-block">
                        Upload arquivo (JPG/PNG)
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                      {formImageUrl && (
                        <button
                          type="button"
                          onClick={() => setFormImageUrl('')}
                          className="text-red-500 hover:text-red-700 text-[11px] font-sans font-semibold"
                        >
                          Remover Imagem
                        </button>
                      )}
                    </div>
                    {formImageUrl && (
                      <div className="w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 mt-1 flex items-center justify-center">
                        <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <button
                  id="submit-product-btn"
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                >
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div id="product-delete-confirm-modal" className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border p-6 text-center space-y-4"
            >
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="font-sans font-bold text-gray-900 text-sm">Excluir Produto</h3>
                <p className="text-xs text-gray-500 font-sans leading-relaxed">
                  Tem certeza que deseja remover este produto do cardápio da cantina? Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProduct(showDeleteConfirm);
                    setShowDeleteConfirm(null);
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
