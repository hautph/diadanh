import React, { useEffect, useState } from "react";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FaSearch, FaFileExcel, FaMapMarkerAlt, FaRegBuilding, FaRegAddressCard, FaCity, FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronRight as FaRight, FaSitemap } from "react-icons/fa";
import "./App.css";

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

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "auto", fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FaMapMarkerAlt size={36} color="#2b7a78" />
          <h1 style={{ color: '#2b7a78', margin: 0 }}>Tra cứu Địa danh Việt Nam</h1>
        </div>
        <div style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>
          © {new Date().getFullYear()} <a href="https://phongtuc.vn" target="_blank" rel="noopener noreferrer" style={{ color: '#3aafa9', textDecoration: 'none', fontWeight: 600 }}>Phong Tục</a>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
      {/* Lịch sử tra cứu */}
      {history.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: 14, color: '#888', width: '100%' }}>
          <span style={{ fontWeight: 600 }}>Lịch sử tra cứu:</span>
          {history.map((h, i) => (
            <button key={i} style={{ margin: '0 6px 6px 0', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
              onClick={() => setSearch(h)}>{h}</button>
          ))}
        </div>
      )}
        <FaSearch color="#3aafa9" size={22} />
        <div style={{ position: 'relative' }}>
          <input
            placeholder="Nhập tên phường/xã, huyện, tỉnh... (có dấu hoặc không dấu, cũ hoặc mới)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 350, fontSize: 18, padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul style={{ position: 'absolute', top: 38, left: 0, right: 0, background: '#fff', border: '1px solid #ccc', borderRadius: 6, zIndex: 10, maxHeight: 180, overflowY: 'auto', margin: 0, padding: 0 }}>
              {suggestions.map((s, i) => (
                <li key={i} style={{ padding: 8, cursor: 'pointer', listStyle: 'none', borderBottom: '1px solid #eee' }}
                  onClick={() => { setSearch(s); setSuggestions([]); }}
                >{s}</li>
              ))}
            </ul>
          )}
        </div>
        <select value={selectedTinh} onChange={e => setSelectedTinh(e.target.value)} style={{ fontSize: 16, padding: 8, borderRadius: 6, border: '1px solid #ccc', minWidth: 160 }}>
          <option value="">-- Lọc theo tỉnh/thành --</option>
          {tinhList.map(tinh => (
            <option key={tinh} value={tinh}>{tinh}</option>
          ))}
        </select>
        {selectedTinh && (
          <button onClick={() => setSelectedTinh("")} style={{ marginLeft: 4, background: '#eee', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}>Xóa lọc</button>
        )}
      </div>
      {(!search || search.length <= 1) && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ color: '#3aafa9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><FaSitemap />Danh sách 34 Tỉnh/Thành phố</h3>
          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: 16 }}>
            {tinhList.map((tinh, idx) => (
              <div key={tinh}>
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600, fontSize: 17, color: '#2b7a78', margin: '6px 0' }} onClick={() => handleToggle(tinh)}>
                  {treeOpen[tinh] ? <FaChevronDown /> : <FaRight />} <FaCity color="#3aafa9" style={{ marginRight: 6 }} /> {tinh}
                </div>
                {treeOpen[tinh] && (
                  <div style={{ marginLeft: 32, marginTop: 4, marginBottom: 8 }}>
                    {treeData[tinh] && Object.keys(treeData[tinh]).sort().map(huyen => (
                      <div key={huyen}>
                        <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#3aafa9', fontWeight: 500, fontSize: 15, margin: '4px 0' }} onClick={() => handleToggle(tinh + '-' + huyen)}>
                          {treeOpen[tinh + '-' + huyen] ? <FaChevronDown /> : <FaRight />} <FaRegBuilding style={{ marginRight: 6 }} /> {huyen}
                        </div>
                        {treeOpen[tinh + '-' + huyen] && (
                          <ul style={{ marginLeft: 32, marginTop: 2, marginBottom: 2, paddingLeft: 0 }}>
                            {treeData[tinh][huyen].sort().map(xa => (
                              <li key={xa} style={{ listStyle: 'none', color: '#222', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0', cursor: 'pointer' }}
                                onClick={() => handleSelectXa(tinh, huyen, xa)}
                              >
                                <FaRegAddressCard color="#888" /> {xa}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Nếu selectedXa có giá trị, hiển thị bảng chi tiết xã/phường đã chọn ở trên bảng kết quả */}
      {selectedXa && (
        <div style={{ marginBottom: 16, color: '#888' }}>
          <div style={{ fontWeight: 600, color: '#2b7a78', marginBottom: 8 }}>Thông tin chi tiết xã/phường đã chọn:</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#e6f2f2' }}>
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
                <td style={{ padding: 8, border: '1px solid #eee', color: '#555' }}>
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
      {/* ...existing code bảng kết quả tìm kiếm và phân trang... */}
      {search && search.length > 1 && (
        <>
          <div style={{ marginBottom: 16, color: '#888' }}>
            Kết quả: {searchResult.length} địa danh{search.length > 1 ? '' : ' (toàn bộ dữ liệu)'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#e6f2f2' }}>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>#</th>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>Thông tin mới</th>
                  <th style={{ padding: 8, border: '1px solid #ddd' }}>Thông tin cũ</th>
                </tr>
              </thead>
              <tbody>
                {pagedData.map((item, idx) => (
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
                    <td style={{ padding: 8, border: '1px solid #eee', color: '#555' }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPage > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, margin: '24px 0' }}>
              <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ background: '#eee', border: 'none', borderRadius: 4, padding: 6, cursor: page === 1 ? 'not-allowed' : 'pointer' }}><FaChevronLeft /></button>
              <span style={{ fontSize: 16 }}>Trang {page} / {totalPage}</span>
              <button onClick={() => setPage(page + 1)} disabled={page === totalPage} style={{ background: '#eee', border: 'none', borderRadius: 4, padding: 6, cursor: page === totalPage ? 'not-allowed' : 'pointer' }}><FaChevronRight /></button>
            </div>
          )}
        </>
      )}
      {searchResult.length === 0 && rawData.length > 0 && search.length > 1 && (
        <div style={{ color: '#b23b3b', marginTop: 20 }}>Không tìm thấy kết quả phù hợp.</div>
      )}
      <button
        onClick={exportExcel}
        style={{ marginTop: 32, background: '#3aafa9', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <FaFileExcel /> Xuất Excel toàn bộ dữ liệu
      </button>
    </div>
  );
}

export default App;
