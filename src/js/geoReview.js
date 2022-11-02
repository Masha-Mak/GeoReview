export default class App {
  constructor(mapId) {
    this.mapId = mapId;
    this.currentCoords = [0, 0];
    this.currentId = 0;
    this.formTemplate = document.querySelector("#addFormTemplate").innerHTML;

    this.injectYMaps();
  }

  onInit() {
    this.map = new ymaps.Map(this.mapId, {
      center: [55.23, 37.21],
      zoom: 8,
      controls: ["zoomControl"],
    });

    this.map.events.add("click", this.onClick.bind(this));
    document.addEventListener("click", this.onDocumentClick.bind(this));

    const openBalloon = this.openBalloon.bind(this);
    const customBalloonContentLayout = ymaps.templateLayoutFactory.createClass(
      `
      <div class="balloon">
        <a href="#" class="balloon-address">{{properties.data.address}}</a>
        <div>
          <b>{{properties.data.name}}</b> <i>{{properties.data.date}}</i> [{{properties.data.place}}]
        </div>
        <div>{{properties.data.text}}</div>
      </div>
    `,
      {
        build() {
          this.constructor.superclass.build.call(this);

          const link = this._element.querySelector(".balloon-address");
          link.addEventListener("click", (e) => {
            e.preventDefault();

            const obj = this.getData().geoObject;

            openBalloon(obj);
          });
        },
      }
    );

    this.objectManager = new ymaps.ObjectManager({
      clusterDisableClickZoom: true,
      clusterize: true,
      clusterBalloonItemContentLayout: customBalloonContentLayout,
      clusterBalloonContentLayout: "cluster#balloonCarousel",
    });

    this.objectManager.objects.events.add("click", (e) => {
      const obj = this.objectManager.objects.getById(e.get("objectId"));

      this.currentCoords = obj.geometry.coordinates;
    });

    this.objectManager.clusters.events.add("click", async (e) => {
      const cluster = this.objectManager.clusters.getById(e.get("objectId"));
      const objs = cluster.properties.geoObjects;

      this.currentCoords = objs[0].geometry.coordinates;
    });

    this.loadPlacemarks();

    this.map.geoObjects.add(this.objectManager);
  }

  async onClick(e) {
    if (this.map.balloon.isOpen()) {
      this.map.balloon.close();
      return;
    }

    this.currentCoords = e.get("coords");

    const address = await this.getAddress(this.currentCoords);
    const layout = `
      <div class="balloon">
        <h4 class="balloon-address">${address}</h4>
        ${this.formTemplate}
      </div>
    `;
    this.map.balloon.open(this.currentCoords, {
      content: layout,
    });
  }

  async onDocumentClick(e) {
    if (e.target.dataset.role === "review-add") {
      const date = new Date().toLocaleDateString();
      const review = {
        name: document.querySelector("[data-role=review-name]").value,
        place: document.querySelector("[data-role=review-place]").value,
        text: document.querySelector("[data-role=review-text]").value,
        date: date,
        coords: this.currentCoords,
      };

      try {
        await this.callApi("add", { coords: this.currentCoords, review });
        const placemark = await this.createPlacemark(
          this.currentCoords,
          review
        );
        this.objectManager.add(placemark);
        this.map.balloon.close();
      } catch (e) {
        const formError = document.querySelector(".form-error");
        formError.innerText = e.message;
      }
    }
  }

  async getReviews(coords) {
    let reviews = [];

    try {
      reviews = await this.callApi("list", { coords });
    } catch (error) {
      console.error("Failed to fetch data:", error.message);
    }

    console.log(reviews.forEach);
    return reviews;
  }

  async openBalloon(obj) {
    const objCoords = obj.geometry.coordinates;
    const data = await this.getReviews(objCoords);
    const address = await this.getAddress(objCoords);

    const items = [];

    data.forEach((review) => {
      const layout = `
        <li class="review-item">
          <div class="review">
          <div>
            <b>${review.name}</b> <i>${review.date}</i> [${review.place}]
          </div>
          <div>${review.text}</div>
          </div>
        </li>
      `;

      items.push(layout);
    });

    const layout = `
      <div class="balloon">
        <h4 class="balloon-address">${address}</h4>
        <ul class="review-list">
          ${items.join("")}
        </ul>
        ${this.formTemplate}
      </div>
    `;

    this.map.balloon.open(objCoords, layout);
  }

  async callApi(method, body = {}) {
    const res = await fetch(`/api/${method}`, {
      method: "post",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw Error(res.statusText);
    }

    return await res.json();
  }

  injectYMaps() {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1?apikey=424859b5-3734-4581-8981-69f15d4628ca&lang=ru_RU`;
    script.addEventListener("load", () => {
      ymaps.ready(this.onInit.bind(this));
    });

    document.body.appendChild(script);
  }

  async loadPlacemarks() {
    let coords = [];

    try {
      coords = await this.callApi("coords");
    } catch (error) {
      console.error("Failed to fetch coordinates:", error.message);
    }

    coords.forEach(async (obj) => {
      const coords = [Number(obj.coords[0]), Number(obj.coords[1])];
      const reviews = await this.getReviews(coords);

      reviews.forEach(async (review) => {
        const placemark = await this.createPlacemark(coords, review);
        this.objectManager.add(placemark);
      });
    });
  }

  async getAddress(coords) {
    try {
      const res = await ymaps.geocode(coords);
      const firstGeoObject = res.geoObjects.get(0);

      return firstGeoObject.getAddressLine();
    } catch {
      return "Не найдено";
    }
  }

  async createPlacemark(coords, data) {
    const address = await this.getAddress(coords);

    const layout = `
      <div class="balloon">
        <h4 class="balloon-address">${address}</h4>
        <ul class="review-list">
          <li class="review-item">
            <div class="review">
            <div>
              <b>${data.name}</b> <i>${data.date}</i> [${data.place}]
            </div>
            <div>${data.text}</div>
            </div>
          </li>
        </ul>
        ${this.formTemplate}
      </div>
    `;

    return {
      id: this.currentId++,
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {
        balloonContent: layout,
        data: {
          name: data.name,
          place: data.place,
          text: data.text,
          date: data.date,
          address: address,
        },
      },
    };
  }
}
