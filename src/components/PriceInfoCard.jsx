import Image from "next/image";

const PriceInfoCard = ({ title, iconSrc, value }) => {
  return (
    <div className={`price-info_card`}>
      <p className="text-base text-black-100">{title}</p>
      <div className="flex gap-1">
        <Image src={iconSrc} alt={title} width={24} height={24} />
        <p className="text-2xl font-bold text-secondary">{value}</p>
      </div>
    </div>
  );
};

export default PriceInfoCard;
