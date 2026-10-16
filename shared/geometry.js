// Optimize edilmiş Çizgi-Daire (Lastik-Oyuncu) ve Süpürülmüş (Swept) Kesişim Algoritmaları
(function (exports) {
  /**
   * 1. AABB (Axis-Aligned Bounding Box) Ön Elemesi (Broad-Phase)
   * İki kutunun kesişip kesişmediğini O(1) toplama/karşılaştırma ile kontrol eder.
   * Karekök veya bölme işlemine girmeden %90+ gereksiz lastik kontrolünü eler.
   */
  function aabbIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
    const minX = (x1 < x2 ? x1 : x2) - r;
    const maxX = (x1 > x2 ? x1 : x2) + r;
    if (cx < minX || cx > maxX) return false;

    const minY = (y1 < y2 ? y1 : y2) - r;
    const maxY = (y1 > y2 ? y1 : y2) + r;
    if (cy < minY || cy > maxY) return false;

    return true;
  }

  /**
   * 2. Nokta - Doğru Parçası En Kısa Mesafe Karesi (Narrow-Phase)
   * P(cx, cy) merkezli ve r yarıçaplı bir oyuncunun, A(x1,y1)-B(x2,y2) lastik
   * doğru parçasına değip değmediğini karekök (Math.sqrt) KULLANMADAN hesaplar.
   */
  function segmentCircleIntersect(x1, y1, x2, y2, cx, cy, r) {
    // Önce hızlı AABB testi
    if (!aabbIntersectsCircle(x1, y1, x2, y2, cx, cy, r)) return null;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0.0001) {
      // Noktanın doğru parçası üzerindeki izdüşümü: t in [0, 1]
      t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }

    // Doğru parçası üzerindeki en yakın nokta
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    const distX = cx - closestX;
    const distY = cy - closestY;
    const distSq = distX * distX + distY * distY;

    if (distSq <= r * r) {
      return { x: closestX, y: closestY, t };
    }
    return null;
  }

  /**
   * 3. Süpürülmüş (Swept / Continuous) Kesme Testi (Tünelleme Önleyici)
   * Sıfır lastikli avcı oyuncular çok hızlı hareket ettiği için iki fizik karesi (tick)
   * arasında lastiğin üzerinden atlayabilir (tunneling). Bunu önlemek için oyuncunun
   * önceki konumu (prevX, prevY) ile yeni konumu (currX, currY) arasındaki hareket
   * vektörünün de lastiği kesip kesmediğini kontrol eder.
   */
  function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const ccw = (p1x, p1y, p2x, p2y, p3x, p3y) =>
      (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
    return (
      ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
      ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy)
    );
  }

  function checkBandCut(anchorX, anchorY, ownerX, ownerY, cutterPrevX, cutterPrevY, cutterX, cutterY, cutterRadius) {
    // 1) Mevcut konumda daire-segment kesişimi
    const hit = segmentCircleIntersect(anchorX, anchorY, ownerX, ownerY, cutterX, cutterY, cutterRadius);
    if (hit) return hit;

    // 2) Hızlı hareket eden oyuncu için önceki konum -> yeni konum çizgi kesişimi
    if (segmentsIntersect(anchorX, anchorY, ownerX, ownerY, cutterPrevX, cutterPrevY, cutterX, cutterY)) {
      return { x: cutterX, y: cutterY, t: 0.5 };
    }

    return null;
  }

  exports.aabbIntersectsCircle = aabbIntersectsCircle;
  exports.segmentCircleIntersect = segmentCircleIntersect;
  exports.checkBandCut = checkBandCut;
})(typeof exports === 'undefined' ? (this.SharedGeometry = {}) : exports);
