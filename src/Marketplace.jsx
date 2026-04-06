import { useState, useEffect } from 'react'
import { products, categories } from './products'

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const AmazonIcon = () => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg"
    alt="Amazon"
    width="40"
    height="12"
    style={{ objectFit: 'contain', display: 'block' }}
  />
)

export default function Marketplace() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    document.body.classList.add('mkt-mode')
    return () => document.body.classList.remove('mkt-mode')
  }, [])

  const filtered = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <main className="mkt-page">
      {/* Hero banner */}
      <section className="mkt-hero">
        <div className="mkt-hero-inner">
          <h1 className="mkt-title">NidanGuru Marketplace</h1>
          <p className="mkt-subtitle">
            Curated spiritual tools, crystals, yantras and ancient wisdom — handpicked to support your journey.
          </p>
        </div>
      </section>

      {/* Category filters + Search */}
      <section className="mkt-filters-wrap">
        <div className="mkt-filters-row">
          <div className="mkt-filters">
            {categories.map(cat => (
              <button
                key={cat}
                className={`mkt-filter-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="mkt-search-wrap">
            <span className="mkt-search-icon"><SearchIcon /></span>
            <input
              className="mkt-search"
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="mkt-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section className="mkt-grid-section">
        <div className="section-wrap">
          {filtered.length === 0 ? (
            <div className="mkt-empty">
              <p>No products found for "<strong>{search}</strong>"</p>
              <button className="btn-primary" onClick={() => { setSearch(''); setActiveCategory('All') }}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <p className="mkt-count">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
              <div className="mkt-grid">
                {filtered.map(product => (
                  <div key={product.id} className="mkt-card">
                    <div className="mkt-card-img-wrap">
                      <img
                        src={product.image}
                        alt={product.name}
                        onError={e => { e.target.src = `https://picsum.photos/seed/${product.id}/400/400` }}
                        className="mkt-card-img"
                        loading="lazy"
                      />
                      <span className="mkt-card-category">{product.category}</span>
                    </div>
                    <div className="mkt-card-body">
                      <h3 className="mkt-card-name">{product.name}</h3>
                      <p className="mkt-card-desc">{product.description}</p>
                      <div className="mkt-card-footer">
                        <span className="mkt-card-price">{product.price}</span>
                      </div>
                      <a
                        className="mkt-buy-btn"
                        href={product.amazonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>Buy on</span>
                        <AmazonIcon />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
