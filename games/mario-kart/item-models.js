import * as T from "three";
export function makeItemModel(type) {
  const colors = {
    banana: "#ffc874",
    green: "#49dcb0",
    red: "#fc8294",
    blue: "#7aafff",
    mushroom: "#ffb86a",
    star: "#b2a0ff",
  };
  const group = new T.Group(),
    material = new T.MeshStandardMaterial({
      color: colors[type] || "#ffffff",
      metalness: 0.25,
      roughness: 0.35,
    });
  const body = new T.Mesh(
    type === "banana"
      ? new T.ConeGeometry(0.42, 0.8, 5)
      : type === "star"
        ? new T.OctahedronGeometry(0.55)
        : new T.IcosahedronGeometry(0.45, 2),
    material,
  );
  group.add(body);
  if (["green", "red", "blue"].includes(type)) {
    const ring = new T.Mesh(
      new T.TorusGeometry(0.65, 0.055, 8, 32),
      new T.MeshStandardMaterial({
        color: "#f3ffff",
        emissive: colors[type],
        emissiveIntensity: 0.5,
      }),
    );
    ring.rotation.x = Math.PI * 0.38;
    group.add(ring);
  }
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return group;
}
