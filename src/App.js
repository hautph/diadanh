import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FaSearch, FaFileExcel, FaMapMarkerAlt, FaRegBuilding, FaRegAddressCard, FaCity, FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronRight as FaRight, FaSitemap } from "react-icons/fa";
import "./App.css";

// CSS dark mode & responsive (inline, có thể chuyển sang file riêng)
const darkStyle = `
body.dark-mode, .dark-mode {
  background: #181a1b !important;
  color: #e0e0e0 !important;
}
.dark-mode input, .dark-mode select, .dark-mode textarea {
  background: #23272a !important;
  color: #e0e0e0 !important;
  border-color: #444 !important;
}
.dark-mode table {
  background: #23272a !important;
  color: #e0e0e0 !important;
}
.dark-mode th, .dark-mode td {
  border-color: #333 !important;
}
.dark-mode .fav-btn {
  background: none !important;
  border: none !important;
  color: #ff5e5e !important;
}
@media (max-width: 700px) {
  .main-wrap {
    padding: 6px !important;
    max-width: 100vw !important;
  }
  .search-row {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 6px !important;
  }
  .search-row input {
    width: 100% !important;
    font-size: 16px !important;
  }
  .search-row select {
    min-width: 0 !important;
    width: 100% !important;
  }
}
`;

// Hàm loại bỏ dấu tiếng Việt
function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\w\s]/gi, "")
    .toLowerCase();
}

const PAGE_SIZE = 10;

function App() {
  const location = typeof window !== 'undefined' ? window.location : { search: '' };
  const navigate = (url) => { if (typeof window !== 'undefined') window.history.pushState({}, '', url); };
  const [rawData, setRawData] = useState([]);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState([]); // Lịch sử tra cứu
  const [selectedTinh, setSelectedTinh] = useState(""); // Lọc nâng cao theo tỉnh
  const [suggestions, setSuggestions] = useState([]); // Gợi ý autocomplete
  const [searchResult, setSearchResult] = useState([]);
  const [tinhList, setTinhList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPage, setTotalPage] = useState(1);
  const [treeOpen, setTreeOpen] = useState({}); // {tinh: true/false, huyen: true/false}
  const [selectedXa, setSelectedXa] = useState(null); // xã được chọn từ cây
  // Dark mode state
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('diadanh_dark') === '1';
    }
    return false;
  });
  // Tab: 0 = tra cứu, 1 = yêu thích
  const [tab, setTab] = useState(0);
  // Yêu thích: lưu vào localStorage, hiển thị ở bảng và chi tiết
  const [favorites, setFavorites] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('diadanh_fav') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  });
  // Thêm/xóa yêu thích
  const toggleFavorite = (item) => {
    const key = item["Tên Phường/Xã mới"] + '|' + item["Tên tỉnh/TP mới"];
    setFavorites(prev => {
      let newFav;
      if (prev.some(f => f.key === key)) {
        newFav = prev.filter(f => f.key !== key);
      } else {
        newFav = [{ key, item }, ...prev].slice(0, 100);
      }
      localStorage.setItem('diadanh_fav', JSON.stringify(newFav));
      return newFav;
    });
  };
  // Lấy danh sách xã/phường yêu thích (dạng mảng item)
  const favList = favorites.map(f => f.item);

  // Thêm style dark mode vào head nếu dark = true
  useEffect(() => {
    let styleTag = document.getElementById('dark-mode-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'dark-mode-style';
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = dark ? darkStyle : '';
    if (dark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('diadanh_dark', dark ? '1' : '0');
  }, [dark]);

  // Đọc file JSON từ public
  useEffect(() => {
    fetch("/danh-muc-phuong-xa_moi.json")
      .then((res) => res.json())
      .then((data) => {
        // Lọc bản ghi hợp lệ
        const filtered = data.filter(
          (item) =>
            (item["Tên tỉnh/TP mới"] || item["Tên tỉnh/TP cũ"]) &&
            (item["Tên Quận huyện TMS (cũ)"] || item["Tên Quận huyện TMS (mới)"]) &&
            (item["Tên Phường/Xã mới"] || item["Tên Phường/Xã cũ"])
        );
        setRawData(filtered);
        // Lấy danh sách 34 tỉnh/thành (theo dữ liệu mới, không trùng, abc)
        const tinhSet = new Set();
        filtered.forEach(item => {
          if (item["Tên tỉnh/TP mới"]) tinhSet.add(item["Tên tỉnh/TP mới"]);
        });
        setTinhList(Array.from(tinhSet).sort());
      });
    // Đọc lịch sử từ localStorage
    const h = localStorage.getItem('diadanh_history');
    if (h) setHistory(JSON.parse(h));
  }, []);

  // Đọc query string khi load trang (chia sẻ link)
  useEffect(() => {
    if (location && location.search) {
      const params = new URLSearchParams(location.search);
      const s = params.get('search') || "";
      const t = params.get('tinh') || "";
      if (s) setSearch(s);
      if (t) setSelectedTinh(t);
    }
  }, []);

  // Đặt lại trang về 1 khi tìm kiếm
  useEffect(() => {
    setPage(1); // reset page khi search
    // Lưu lịch sử tra cứu chỉ khi có kết quả thực sự và có thông tin phường/xã
    if (
      search &&
      search.length > 1 &&
      searchResult.length > 0 &&
      searchResult.every(item => (item["Tên Phường/Xã mới"] && item["Tên Phường/Xã mới"].trim()) || (item["Tên Phường/Xã cũ"] && item["Tên Phường/Xã cũ"].trim()))
    ) {
      setHistory(prev => {
        const newHist = [search, ...prev.filter(x => x !== search)].slice(0, 10);
        localStorage.setItem('diadanh_history', JSON.stringify(newHist));
        return newHist;
      });
    }
    // Cập nhật URL khi search
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (selectedTinh) params.set('tinh', selectedTinh);
    navigate(params.toString() ? `?${params.toString()}` : location.pathname);
  }, [search, selectedTinh, searchResult]);

  // Tìm kiếm nâng cao: có dấu hoặc không dấu, tìm cả tên cũ và mới, lọc theo tỉnh
  useEffect(() => {
    let result = rawData;
    if (selectedTinh) {
      result = result.filter(item => item["Tên tỉnh/TP mới"] === selectedTinh);
    }
    if (search.length > 1) {
      const searchNoSign = removeVietnameseTones(search);
      result = result.filter((item) => {
        const tenXaMoi = item["Tên Phường/Xã mới"] || "";
        const tenXaCu = item["Tên Phường/Xã cũ"] || "";
        const tenHuyenMoi = item["Tên Quận huyện TMS (cũ)"] || item["Tên Quận huyện TMS (mới)"] || "";
        const tenHuyenCu = item["Tên Quận huyện TMS (cũ)"] || "";
        const tenTinhMoi = item["Tên tỉnh/TP mới"] || "";
        const tenTinhCu = item["Tên tỉnh/TP cũ"] || "";
        const hasSign =
          tenXaMoi.toLowerCase().includes(search.toLowerCase()) ||
          tenXaCu.toLowerCase().includes(search.toLowerCase()) ||
          tenHuyenMoi.toLowerCase().includes(search.toLowerCase()) ||
          tenHuyenCu.toLowerCase().includes(search.toLowerCase()) ||
          tenTinhMoi.toLowerCase().includes(search.toLowerCase()) ||
          tenTinhCu.toLowerCase().includes(search.toLowerCase());
        const noSign =
          removeVietnameseTones(tenXaMoi).includes(searchNoSign) ||
          removeVietnameseTones(tenXaCu).includes(searchNoSign) ||
          removeVietnameseTones(tenHuyenMoi).includes(searchNoSign) ||
          removeVietnameseTones(tenHuyenCu).includes(searchNoSign) ||
          removeVietnameseTones(tenTinhMoi).includes(searchNoSign) ||
          removeVietnameseTones(tenTinhCu).includes(searchNoSign);
        return hasSign || noSign;
      });
    }
    setSearchResult(result);
    setTotalPage(Math.max(1, Math.ceil(result.length / PAGE_SIZE)));
  }, [search, rawData, selectedTinh]);

  // Gợi ý autocomplete khi nhập từ khóa
  useEffect(() => {
    if (search.length > 0) {
      const searchNoSign = removeVietnameseTones(search);
      const sugg = rawData
        .filter(item => {
          const tenXaMoi = item["Tên Phường/Xã mới"] || "";
          const tenXaCu = item["Tên Phường/Xã cũ"] || "";
          return (
            tenXaMoi.toLowerCase().includes(search.toLowerCase()) ||
            tenXaCu.toLowerCase().includes(search.toLowerCase()) ||
            removeVietnameseTones(tenXaMoi).includes(searchNoSign) ||
            removeVietnameseTones(tenXaCu).includes(searchNoSign)
          );
        })
        .slice(0, 8)
        .map(item => item["Tên Phường/Xã mới"])
        .filter((v, i, arr) => v && arr.indexOf(v) === i);
      setSuggestions(sugg);
    } else {
      setSuggestions([]);
    }
  }, [search, rawData]);

  // Xuất Excel
  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(rawData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DiaDanh");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "diadanh.xlsx");
  };

  // Lấy dữ liệu trang hiện tại
  const pagedData = searchResult.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Cây địa danh: tỉnh -> huyện -> xã
  const handleToggle = (key) => {
    setTreeOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Khi click vào xã trong cây, chỉ hiển thị chi tiết xã ở khung riêng, không reset search/searchResult
  const handleSelectXa = (tinh, huyen, xa) => {
    const found = rawData.find(
      (item) =>
        item["Tên tỉnh/TP mới"] === tinh &&
        item["Tên Quận huyện TMS (cũ)"] === huyen &&
        item["Tên Phường/Xã mới"] === xa
    );
    if (found) {
      setSelectedXa(found);
    }
  };

  // Dữ liệu cây: tỉnh -> huyện -> xã
  const treeData = React.useMemo(() => {
    const tinhMap = {};
    rawData.forEach(item => {
      const tinh = item["Tên tỉnh/TP mới"];
      const huyen = item["Tên Quận huyện TMS (cũ)"];
      const xa = item["Tên Phường/Xã mới"];
      if (!tinh || !huyen || !xa) return;
      if (!tinhMap[tinh]) tinhMap[tinh] = {};
      if (!tinhMap[tinh][huyen]) tinhMap[tinh][huyen] = [];
      tinhMap[tinh][huyen].push(xa);
    });
    return tinhMap;
  }, [rawData]);

  // RETURN DUY NHẤT, JSX CHUẨN HÓA
  return (
    <>
      {/* SEO META TAGS */}
      <head>
        <title>Tra cứu Địa danh Việt Nam - Tìm kiếm xã phường, huyện quận, tỉnh thành</title>
        <meta name="description" content="Tra cứu địa danh Việt Nam: xã, phường, huyện, quận, tỉnh, thành phố. Tìm kiếm nhanh, xuất Excel, lưu yêu thích. Dữ liệu hành chính mới nhất 2025." />
        <meta name="keywords" content="tra cứu địa danh, xã phường, huyện quận, tỉnh thành, địa danh Việt Nam, xuất excel, tìm kiếm địa danh, dữ liệu hành chính, hành chính Việt Nam, địa giới hành chính, địa chỉ, tra cứu xã phường, bản đồ hành chính, địa danh 2025" />
      </head>
      <div className="main-wrap" style={{ maxWidth: 900, margin: '0 auto', padding: 0, background: dark ? '#181a1b' : '#f9f9f9', borderRadius: 18, boxShadow: '0 4px 32px #0002', overflow: 'hidden' }}>
        {/* HEADER HIỆN ĐẠI */}
        <header style={{
          background: dark ? 'linear-gradient(90deg,#23272a 60%,#3aafa9 100%)' : 'linear-gradient(90deg,#e6f2f2 60%,#3aafa9 100%)',
          padding: '32px 32px 24px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          borderBottom: `3px solid ${dark ? '#3aafa9' : '#2b7a78'}`,
          boxShadow: dark ? '0 2px 12px #0004' : '0 2px 12px #3aafa933',
          flexWrap: 'wrap',
          position: 'relative'
        }}>
          <img src="/logo192.png" alt="logo" style={{ width: 70, height: 70, borderRadius: 18, background: '#fff', boxShadow: '0 2px 12px #0002', border: `3px solid ${dark ? '#3aafa9' : '#2b7a78'}` }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ margin: 0, color: dark ? '#3aafa9' : '#2b7a78', fontSize: 36, fontWeight: 900, letterSpacing: 0.5, lineHeight: 1.1, textShadow: dark ? '0 2px 8px #0008' : '0 2px 8px #3aafa933' }}>Tra cứu Địa danh Việt Nam</h1>
            <div style={{ color: dark ? '#eee' : '#333', fontSize: 18, marginTop: 8, fontWeight: 500, textShadow: dark ? '0 1px 4px #0006' : 'none' }}>
              Tìm kiếm xã, phường, tỉnh, thành phố. Dữ liệu hành chính mới nhất, xuất Excel, lưu yêu thích.
            </div>
          </div>
          <div style={{ position: 'absolute', right: 32, top: 32, fontSize: 15, color: dark ? '#aaa' : '#2b7a78', fontWeight: 600, letterSpacing: 0.2 }}>
            <span style={{ background: dark ? '#3aafa9' : '#e6f2f2', color: dark ? '#222' : '#2b7a78', borderRadius: 8, padding: '4px 12px' }}>
              Dữ liệu cập nhật 2025
            </span>
          </div>
        </header>
        {/* KHUNG TÌM KIẾM VÀ GỢI Ý */}
      <div className="search-row" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Nhập tên xã/phường, huyện/quận, tỉnh/thành..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
          autoFocus
          list="suggestions-list"
        />
        <datalist id="suggestions-list">
          {suggestions.map((s, i) => <option value={s} key={i} />)}
        </datalist>
        <select
          value={selectedTinh}
          onChange={e => setSelectedTinh(e.target.value)}
          style={{ minWidth: 140, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        >
          <option value="">-- Tất cả tỉnh/thành --</option>
          {tinhList.map(tinh => <option key={tinh} value={tinh}>{tinh}</option>)}
        </select>
        <button
          onClick={() => setTab(0)}
          style={{ background: tab === 0 ? (dark ? '#3aafa9' : '#2b7a78') : '#eee', color: tab === 0 ? '#fff' : '#222', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
        >
          Tra cứu
        </button>
        <button
          onClick={() => setTab(1)}
          style={{ background: tab === 1 ? (dark ? '#3aafa9' : '#2b7a78') : '#eee', color: tab === 1 ? '#fff' : '#222', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}
        >
          Yêu thích
        </button>
        <button
          onClick={() => setDark(d => !d)}
          style={{ marginLeft: 8, background: dark ? '#222' : '#eee', color: dark ? '#fff' : '#222', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}
          title="Chuyển chế độ sáng/tối"
        >
          {dark ? '🌙' : '☀️'}
        </button>
      </div>
      {/* GỢI Ý AUTOCOMPLETE */}
      {search.length > 0 && suggestions.length > 0 && (
        <div style={{ background: dark ? '#23272a' : '#fff', border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, maxWidth: 400 }}>
          <div style={{ color: dark ? '#aaa' : '#888', marginBottom: 4, fontSize: 14 }}>Gợi ý:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {suggestions.map((s, i) => (
              <span key={i} style={{ background: dark ? '#3aafa9' : '#e6f2f2', color: dark ? '#222' : '#2b7a78', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 15 }}
                onClick={() => setSearch(s)}>{s}</span>
            ))}
          </div>
        </div>
      )}
      {tab === 0 && (!search || search.length <= 1) && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#3aafa9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><FaSitemap />Danh sách 34 Tỉnh/Thành phố</h3>
          <div style={{ background: dark ? '#23272a' : '#f8f8f8', borderRadius: 10, padding: 18, boxShadow: dark ? '0 2px 8px #0002' : '0 2px 8px #3aafa911' }}>
            {tinhList.map((tinh) => (
              <div key={tinh} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 700, fontSize: 18, color: dark ? '#3aafa9' : '#2b7a78', margin: '8px 0', borderRadius: 6, padding: '6px 10px', transition: 'background 0.2s', background: selectedTinh === tinh ? (dark ? '#3aafa933' : '#e6f2f2') : 'none' }}
                  onClick={() => { setSelectedTinh(tinh); setTab(0); setSelectedXa(null); }}
                >
                  <FaCity color="#3aafa9" style={{ marginRight: 8 }} /> {tinh}
                </div>
                {/* Hiển thị danh sách xã trực tiếp dưới tỉnh */}
                {selectedTinh === tinh && treeData[tinh] && (
                  <ul style={{ marginLeft: 32, marginTop: 6, marginBottom: 6, paddingLeft: 0 }}>
                    {Object.keys(treeData[tinh]).sort().flatMap(huyen =>
                      treeData[tinh][huyen].sort().map(xa => (
                        <li key={xa} style={{ listStyle: 'none', color: dark ? '#eee' : '#222', fontSize: 15, display: 'flex', alignItems: 'center', gap: 7, margin: '2px 0', cursor: 'pointer', borderRadius: 4, padding: '2px 8px', transition: 'background 0.2s', background: selectedXa && selectedXa["Tên Phường/Xã mới"] === xa ? (dark ? '#3aafa955' : '#e6f2f2') : 'none' }}
                          onClick={() => handleSelectXa(tinh, huyen, xa)}
                        >
                          <FaRegAddressCard color="#888" /> {xa}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Chi tiết tỉnh/thành phố đã chọn */}
      {tab === 0 && selectedTinh && !selectedXa && (
        <div style={{ marginBottom: 18, background: dark ? '#23272a' : '#e6f2f2', borderRadius: 8, padding: 18, color: dark ? '#3aafa9' : '#2b7a78', fontWeight: 600, fontSize: 18, boxShadow: dark ? '0 2px 8px #0002' : '0 2px 8px #3aafa911' }}>
          <FaCity style={{ marginRight: 8 }} /> Thông tin tỉnh/thành phố: <span style={{ fontWeight: 800 }}>{selectedTinh}</span>
        </div>
      )}
      {/* Chi tiết xã/phường đã chọn */}
      {tab === 0 && selectedXa && (
        <div style={{ marginBottom: 16, color: dark ? '#aaa' : '#888' }}>
          <div style={{ fontWeight: 600, color: dark ? '#3aafa9' : '#2b7a78', marginBottom: 8 }}>
            Thông tin chi tiết xã/phường đã chọn:
            <button className="fav-btn" onClick={() => toggleFavorite(selectedXa)} style={{ marginLeft: 10, fontSize: 20, cursor: 'pointer', background: 'none', border: 'none' }} title="Yêu thích">
              {favorites.some(f => f.key === (selectedXa["Tên Phường/Xã mới"] + '|' + selectedXa["Tên tỉnh/TP mới"])) ? '❤️' : '🤍'}
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: dark ? '#23272a' : '#fff' }}>
            <thead>
              <tr style={{ background: dark ? '#223' : '#e6f2f2' }}>
                <th style={{ padding: 8, border: '1px solid #ddd' }}>Thông tin mới</th>
                <th style={{ padding: 8, border: '1px solid #ddd' }}>Thông tin cũ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 8, border: '1px solid #eee' }}>
                  <b>{selectedXa["Tên Phường/Xã mới"]}</b><br />
                  {selectedXa["Tên tỉnh/TP mới"] && <span><FaCity color="#3aafa9" style={{ marginRight: 3 }} />Tỉnh/TP: {selectedXa["Tên tỉnh/TP mới"]}<br /></span>}
                  {selectedXa["Mã phường/xã mới "] && <span>Mã xã: {selectedXa["Mã phường/xã mới "]}</span>}
                </td>
                <td style={{ padding: 8, border: '1px solid #eee', color: dark ? '#ccc' : '#555' }}>
                  {(selectedXa["Tên Phường/Xã cũ"] || selectedXa["Tên Quận huyện TMS (cũ)"] || selectedXa["Tên tỉnh/TP cũ"] || selectedXa["Mã phường/xã cũ"] || selectedXa["Mã Quận huyện TMS (cũ)"]) ? (
                    <div>
                      {selectedXa["Tên Phường/Xã cũ"] && <><b>{selectedXa["Tên Phường/Xã cũ"]}</b><br /></>}
                      {selectedXa["Tên Quận huyện TMS (cũ)"] && <span>Huyện/Quận: {selectedXa["Tên Quận huyện TMS (cũ)"]}<br /></span>}
                      {selectedXa["Mã Quận huyện TMS (cũ)"] && <span>Mã Quận huyện TMS (cũ): {selectedXa["Mã Quận huyện TMS (cũ)"]}<br /></span>}
                      {selectedXa["Tên tỉnh/TP cũ"] && <span>Tỉnh/TP: {selectedXa["Tên tỉnh/TP cũ"]}<br /></span>}
                      {selectedXa["Mã phường/xã cũ"] && <span>Mã xã: {selectedXa["Mã phường/xã cũ"]}</span>}
                    </div>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {/* Bảng kết quả tìm kiếm và phân trang */}
      {tab === 0 && search && search.length > 1 && (
        <>
          <div style={{ marginBottom: 16, color: dark ? '#aaa' : '#888' }}>
            Kết quả: {searchResult.length} địa danh{search.length > 1 ? '' : ' (toàn bộ dữ liệu)'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: dark ? '#23272a' : '#fff' }}>
              <thead>
                <tr style={{ background: dark ? '#223' : '#e6f2f2' }}>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>#</th>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>Thông tin mới</th>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>Thông tin cũ</th>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>Yêu thích</th>
                </tr>
              </thead>
              <tbody>
                {pagedData.map((item, idx) => {
                  const favKey = item["Tên Phường/Xã mới"] + '|' + item["Tên tỉnh/TP mới"];
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FaRegAddressCard color="#2b7a78" />
                          <div>
                            <b>{item["Tên Phường/Xã mới"]}</b><br />
                            {item["Tên tỉnh/TP mới"] && <span><FaCity color="#3aafa9" style={{ marginRight: 3 }} />Tỉnh/TP: {item["Tên tỉnh/TP mới"]}<br /></span>}
                            {item["Mã phường/xã mới "] && <span>Mã xã: {item["Mã phường/xã mới "]}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 8, border: '1px solid #eee', color: dark ? '#ccc' : '#555' }}>
                        {(item["Tên Phường/Xã cũ"] || item["Tên Quận huyện TMS (cũ)"] || item["Tên tỉnh/TP cũ"] || item["Mã phường/xã cũ"] || item["Mã Quận huyện TMS (cũ)"]) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FaRegAddressCard color="#b23b3b" />
                            <div>
                              {item["Tên Phường/Xã cũ"] && <><b>{item["Tên Phường/Xã cũ"]}</b><br /></>}
                              {item["Tên Quận huyện TMS (cũ)"] && <span><FaRegBuilding color="#b23b3b" style={{ marginRight: 3 }} />Huyện/Quận: {item["Tên Quận huyện TMS (cũ)"]}<br /></span>}
                              {item["Mã Quận huyện TMS (cũ)"] && <span>Mã Quận huyện TMS (cũ): {item["Mã Quận huyện TMS (cũ)"]}<br /></span>}
                              {item["Tên tỉnh/TP cũ"] && <span><FaCity color="#b23b3b" style={{ marginRight: 3 }} />Tỉnh/TP: {item["Tên tỉnh/TP cũ"]}<br /></span>}
                              {item["Mã phường/xã cũ"] && <span>Mã xã: {item["Mã phường/xã cũ"]}</span>}
                            </div>
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>
                        <button className="fav-btn" onClick={() => toggleFavorite(item)} style={{ fontSize: 20, cursor: 'pointer', background: 'none', border: 'none' }} title="Yêu thích">
                          {favorites.some(f => f.key === favKey) ? '❤️' : '🤍'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPage > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ background: dark ? '#23272a' : '#eee', border: 'none', borderRadius: 4, padding: 6, cursor: page === 1 ? 'not-allowed' : 'pointer', color: dark ? '#fff' : '#222' }}><FaChevronLeft /></button>
              <span style={{ fontSize: 16 }}>Trang {page} / {totalPage}</span>
              <button onClick={() => setPage(page + 1)} disabled={page === totalPage} style={{ background: dark ? '#23272a' : '#eee', border: 'none', borderRadius: 4, padding: 6, cursor: page === totalPage ? 'not-allowed' : 'pointer', color: dark ? '#fff' : '#222' }}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}
      {tab === 0 && searchResult.length === 0 && rawData.length > 0 && search.length > 1 && (
        <div style={{ color: '#b23b3b', marginTop: 20 }}>Không tìm thấy kết quả phù hợp.</div>
      )}
      {/* Tab yêu thích: hiển thị danh sách xã/phường đã lưu */}
      {tab === 1 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ color: dark ? '#3aafa9' : '#2b7a78', marginBottom: 10 }}>Danh sách xã/phường yêu thích ({favList.length})</h3>
          {favList.length === 0 ? (
            <div style={{ color: '#888' }}>Chưa có xã/phường nào được đánh dấu yêu thích.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: dark ? '#23272a' : '#fff' }}>
                <thead>
                  <tr style={{ background: dark ? '#223' : '#e6f2f2' }}>
                    <th style={{ padding: 8, border: '1px solid #ddd' }}>#</th>
                    <th style={{ padding: 8, border: '1px solid #ddd' }}>Tên Phường/Xã</th>
                    <th style={{ padding: 8, border: '1px solid #ddd' }}>Tỉnh/TP</th>
                    <th style={{ padding: 8, border: '1px solid #ddd' }}>Mã xã</th>
                    <th style={{ padding: 8, border: '1px solid #ddd' }}>Xem chi tiết</th>
                    <th style={{ padding: 8, border: '1px solid #ddd' }}>Bỏ yêu thích</th>
                  </tr>
                </thead>
                <tbody>
                  {favList.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{item["Tên Phường/Xã mới"]}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{item["Tên tỉnh/TP mới"]}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>{item["Mã phường/xã mới "]}</td>
                      <td style={{ padding: 8, border: '1px solid #eee' }}>
                        <button onClick={() => { setTab(0); setSelectedXa(item); }} style={{ background: dark ? '#3aafa9' : '#2b7a78', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>Chi tiết</button>
                      </td>
                      <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>
                        <button className="fav-btn" onClick={() => toggleFavorite(item)} style={{ fontSize: 20, cursor: 'pointer', background: 'none', border: 'none' }} title="Bỏ yêu thích">❤️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        <button
          onClick={exportExcel}
          style={{ marginTop: 32, background: dark ? '#3aafa9' : '#3aafa9', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 22px', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, boxShadow: '0 2px 8px #0001' }}
        >
          <FaFileExcel /> Xuất Excel toàn bộ dữ liệu
        </button>
        {/* FOOTER HIỆN ĐẠI */}
        <footer style={{
          marginTop: 56,
          textAlign: 'center',
          color: dark ? '#aaa' : '#2b7a78',
          fontSize: 16,
          borderTop: `3px solid ${dark ? '#3aafa9' : '#2b7a78'}`,
          paddingTop: 28,
          letterSpacing: 0.2,
          background: dark ? 'linear-gradient(90deg,#23272a 60%,#3aafa9 100%)' : 'linear-gradient(90deg,#e6f2f2 60%,#3aafa9 100%)',
          fontWeight: 600,
          boxShadow: dark ? '0 -2px 12px #0004' : '0 -2px 12px #3aafa933',
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18
        }}>
          <div style={{ marginBottom: 6 }}>
            © {new Date().getFullYear()} <span style={{ fontWeight: 900 }}>Tra cứu Địa danh Việt Nam</span>
          </div>
          <div style={{ fontSize: 15, color: dark ? '#eee' : '#222', fontWeight: 400 }}>
            Dữ liệu hành chính cập nhật 2025. Thiết kế bởi
            <a href="https://github.com/hautp" target="_blank" rel="noopener noreferrer" style={{ color: dark ? '#fff' : '#2b7a78', textDecoration: 'underline', fontWeight: 700, marginLeft: 6 }}>hautp</a>.
          </div>
        </footer>
      </div>
    </>
  );
}

export default App;
